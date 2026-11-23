import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useContacts, useCreateDeal, useOffline, useOrganizations, useUpdateDeal } from "../api/queries";
import type { Deal, DealInput, Stage } from "../api/types";
import { Picker } from "../components/Picker";
import { SidePanel } from "../components/SidePanel";
import { STAGES, usualProbability } from "../lib/deals";
import { ContactForm } from "./ContactForm";
import { FieldShell, FormActions, FormError, TextField, applyServerErrors, rules, zodResolver } from "./fields";
import { OrganizationForm } from "./OrganizationForm";

const STAGE_KEYS = ["new", "qualified", "proposal", "negotiation", "won", "lost"] as const;

const base = z.object({
  name: rules.name,
  organizationId: z.number().nullable(),
  contactId: z.number().nullable(),
  stage: z.enum(STAGE_KEYS),
  value: rules.value,
  probability: rules.probability,
  closeDate: rules.closeDate,
});
type Values = z.infer<typeof base>;
// R12: every link is required on create. An edit may keep a link a delete cleared (R34).
const createSchema = base
  .refine((v) => v.organizationId !== null, { message: "Choose an organization.", path: ["organizationId"] })
  .refine((v) => v.contactId !== null, { message: "Choose a contact.", path: ["contactId"] });
const FIELDS = ["name", "organizationId", "contactId", "stage", "value", "probability", "closeDate"] as const;

interface NewDealDefaults {
  stage: Stage;
  organizationId: number | null;
  contactId: number | null;
}

function initialValues(deal: Deal | undefined, defaults: NewDealDefaults): Values {
  if (deal) {
    return {
      name: deal.name,
      organizationId: deal.organizationId,
      contactId: deal.contactId,
      stage: deal.stage,
      value: String(deal.value),
      probability: String(deal.probability),
      closeDate: deal.closeDate,
    };
  }
  return {
    name: "",
    organizationId: defaults.organizationId,
    contactId: defaults.contactId,
    stage: defaults.stage,
    value: "",
    probability: String(usualProbability(defaults.stage)),
    closeDate: "",
  };
}

interface Props {
  deal?: Deal;
  /** The stage chosen when the form opens, for "Add deal" in a pipeline column (R65). */
  defaultStage?: Stage;
  defaultOrganizationId?: number | null;
  defaultContactId?: number | null;
  onSaved: (deal: Deal) => void;
  onCancel: () => void;
}

/** R12, R15 (probability filled in from the stage), R21, R23 (contacts filtered), R45, R48. */
export function DealForm({
  deal,
  defaultStage = "new",
  defaultOrganizationId = null,
  defaultContactId = null,
  onSaved,
  onCancel,
}: Props) {
  const create = useCreateDeal();
  const update = useUpdateDeal();
  const offline = useOffline();
  const organizations = useOrganizations();
  const contacts = useContacts();
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState<"organization" | "contact" | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Values>({
    resolver: zodResolver(deal ? base : createSchema),
    defaultValues: initialValues(deal, {
      stage: defaultStage,
      organizationId: defaultOrganizationId,
      contactId: defaultContactId,
    }),
  });

  const organizationId = useWatch({ control, name: "organizationId" });
  const organizationOptions = useMemo(
    () => (organizations.data ?? []).map((o) => ({ value: o.id, label: o.name })),
    [organizations.data],
  );
  // R23: only the chosen organization's contacts can be the main contact.
  const contactOptions = useMemo(
    () =>
      (contacts.data ?? [])
        .filter((c) => organizationId !== null && c.organizationId === organizationId)
        .map((c) => ({ value: c.id, label: c.name })),
    [contacts.data, organizationId],
  );

  function chooseOrganization(id: number | null) {
    setValue("organizationId", id, { shouldDirty: true });
    const contactId = getValues("contactId");
    const contact = contacts.data?.find((c) => c.id === contactId);
    if (contact && contact.organizationId !== id) setValue("contactId", null, { shouldDirty: true });
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    const input: DealInput = { name: values.name.trim(), value: Number(values.value), closeDate: values.closeDate };
    if (!deal) {
      Object.assign(input, {
        organizationId: values.organizationId,
        contactId: values.contactId,
        stage: values.stage,
        probability: Number(values.probability),
      });
    } else {
      // Only what changed, and never a link left empty (R34). A changed stage brings its probability (R15).
      if (dirtyFields.organizationId && values.organizationId !== null) input.organizationId = values.organizationId;
      if (dirtyFields.contactId && values.contactId !== null) input.contactId = values.contactId;
      if (values.stage !== deal.stage) input.stage = values.stage;
      if (dirtyFields.probability || values.stage !== deal.stage) input.probability = Number(values.probability);
    }
    try {
      const saved = deal ? await update.mutateAsync({ id: deal.id, input }) : await create.mutateAsync(input);
      onSaved(saved);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS, "deal"));
    }
  }

  const saving = isSubmitting || create.isPending || update.isPending;
  return (
    <>
      <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Deal">
        <FormError message={formError} />
        <TextField label="Name" error={errors.name?.message} autoComplete="off" {...register("name")} />
        <Controller
          control={control}
          name="organizationId"
          render={({ field }) => (
            <Picker
              label="Organization"
              name={field.name}
              value={field.value}
              options={organizationOptions}
              onChange={chooseOrganization}
              addLabel="Add organization"
              onAdd={() => setAdding("organization")}
              placeholder={deal ? "None" : "Choose an organization"}
              error={errors.organizationId?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="contactId"
          render={({ field }) => (
            <Picker
              label="Main contact"
              name={field.name}
              value={field.value}
              options={contactOptions}
              onChange={field.onChange}
              addLabel="Add contact"
              onAdd={() => setAdding("contact")}
              placeholder={organizationId === null ? "Choose an organization first" : "Choose a contact"}
              error={errors.contactId?.message}
            />
          )}
        />
        <div className="field-row">
          <FieldShell label="Stage" error={errors.stage?.message}>
            {(props) => (
              <select
                {...props}
                {...register("stage", {
                  // R15: a new stage fills in its usual probability, which can be overwritten before saving.
                  onChange: (event: { target: { value: Stage } }) =>
                    setValue("probability", String(usualProbability(event.target.value)), { shouldDirty: true }),
                })}
              >
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </FieldShell>
          <TextField
            label="Probability (%)"
            inputMode="numeric"
            error={errors.probability?.message}
            {...register("probability")}
          />
        </div>
        <div className="field-row">
          <TextField label="Value (USD)" inputMode="numeric" error={errors.value?.message} {...register("value")} />
          <TextField label="Close date" type="date" error={errors.closeDate?.message} {...register("closeDate")} />
        </div>
        <FormActions
          saving={saving}
          offline={offline}
          saveLabel={deal ? "Save changes" : "Add deal"}
          onCancel={onCancel}
        />
      </form>
      <SidePanel
        open={adding === "organization"}
        onOpenChange={(open) => setAdding(open ? "organization" : null)}
        title="Add organization"
      >
        <OrganizationForm
          onCancel={() => setAdding(null)}
          onSaved={(organization) => {
            chooseOrganization(organization.id);
            setAdding(null);
          }}
        />
      </SidePanel>
      <SidePanel
        open={adding === "contact"}
        onOpenChange={(open) => setAdding(open ? "contact" : null)}
        title="Add contact"
      >
        <ContactForm
          defaultOrganizationId={organizationId}
          onCancel={() => setAdding(null)}
          onSaved={(contact) => {
            if (contact.organizationId !== null)
              setValue("organizationId", contact.organizationId, { shouldDirty: true });
            setValue("contactId", contact.id, { shouldDirty: true, shouldValidate: true });
            setAdding(null);
          }}
        />
      </SidePanel>
    </>
  );
}
