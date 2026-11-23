import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateContact, useOffline, useOrganizations, useUpdateContact } from "../api/queries";
import type { Contact, ContactInput } from "../api/types";
import { Picker } from "../components/Picker";
import { SidePanel } from "../components/SidePanel";
import { CONTACT_STATUSES, type ContactStatus } from "../lib/deals";
import {
  FieldShell,
  FormActions,
  FormError,
  TextField,
  applyServerErrors,
  optional,
  rules,
  zodResolver,
} from "./fields";
import { OrganizationForm } from "./OrganizationForm";

const base = z.object({
  name: rules.name,
  organizationId: z.number().nullable(),
  email: rules.email,
  phone: rules.phone,
  jobTitle: rules.jobTitle,
  status: z.enum(["lead", "qualified", "customer"]),
});
type Values = z.infer<typeof base>;
// R11: an organization is required on create, for leads too. An edit may keep a link a delete cleared (R34).
const createSchema = base.refine((v) => v.organizationId !== null, {
  message: "Choose an organization.",
  path: ["organizationId"],
});
const FIELDS = ["name", "organizationId", "email", "phone", "jobTitle", "status"] as const;

function initialValues(contact: Contact | undefined, defaultOrganizationId: number | null): Values {
  return {
    name: contact?.name ?? "",
    organizationId: contact ? contact.organizationId : defaultOrganizationId,
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    jobTitle: contact?.jobTitle ?? "",
    status: contact?.status ?? "lead",
  };
}

interface Props {
  contact?: Contact;
  /** The organization chosen when the form opens (for example from an organization's page). */
  defaultOrganizationId?: number | null;
  onSaved: (contact: Contact) => void;
  onCancel: () => void;
}

/** R11, R21, R45 (with "Add organization" in the picker), R48. */
export function ContactForm({ contact, defaultOrganizationId = null, onSaved, onCancel }: Props) {
  const create = useCreateContact();
  const update = useUpdateContact();
  const offline = useOffline();
  const organizations = useOrganizations();
  const [formError, setFormError] = useState<string | null>(null);
  const [addingOrganization, setAddingOrganization] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Values>({
    resolver: zodResolver(contact ? base : createSchema),
    defaultValues: initialValues(contact, defaultOrganizationId),
  });

  const options = useMemo(
    () => (organizations.data ?? []).map((o) => ({ value: o.id, label: o.name })),
    [organizations.data],
  );

  async function onSubmit(values: Values) {
    setFormError(null);
    const input: ContactInput = {
      name: values.name.trim(),
      email: optional(values.email),
      phone: optional(values.phone),
      jobTitle: optional(values.jobTitle),
      status: values.status as ContactStatus,
    };
    // A cleared link that stays empty isn't sent, so the save is allowed (R34).
    if (!contact || (dirtyFields.organizationId && values.organizationId !== null)) {
      input.organizationId = values.organizationId;
    }
    try {
      const saved = contact ? await update.mutateAsync({ id: contact.id, input }) : await create.mutateAsync(input);
      onSaved(saved);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS, "contact"));
    }
  }

  const saving = isSubmitting || create.isPending || update.isPending;
  return (
    <>
      <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Contact">
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
              options={options}
              onChange={field.onChange}
              addLabel="Add organization"
              onAdd={() => setAddingOrganization(true)}
              placeholder={contact ? "None" : "Choose an organization"}
              error={errors.organizationId?.message}
            />
          )}
        />
        <TextField label="Job title" error={errors.jobTitle?.message} {...register("jobTitle")} />
        <TextField label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <TextField label="Phone" type="tel" error={errors.phone?.message} {...register("phone")} />
        <FieldShell label="Status" error={errors.status?.message}>
          {(props) => (
            <select {...props} {...register("status")}>
              {CONTACT_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </FieldShell>
        <FormActions
          saving={saving}
          offline={offline}
          saveLabel={contact ? "Save changes" : "Add contact"}
          onCancel={onCancel}
        />
      </form>
      <SidePanel open={addingOrganization} onOpenChange={setAddingOrganization} title="Add organization">
        <OrganizationForm
          onCancel={() => setAddingOrganization(false)}
          onSaved={(organization) => {
            // Back in the contact form with the new organization chosen (WF-3).
            setValue("organizationId", organization.id, { shouldDirty: true, shouldValidate: true });
            setAddingOrganization(false);
          }}
        />
      </SidePanel>
    </>
  );
}
