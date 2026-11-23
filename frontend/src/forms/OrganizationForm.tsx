import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateOrganization, useOffline, useUpdateOrganization } from "../api/queries";
import type { Organization } from "../api/types";
import {
  FormActions,
  FormError,
  TextAreaField,
  TextField,
  applyServerErrors,
  optional,
  rules,
  zodResolver,
} from "./fields";

const schema = z.object({
  name: rules.name,
  website: rules.website,
  industry: rules.industry,
  notes: rules.notes,
});
type Values = z.infer<typeof schema>;
const FIELDS = ["name", "website", "industry", "notes"] as const;

function initialValues(organization: Organization | undefined): Values {
  return {
    name: organization?.name ?? "",
    website: organization?.website ?? "",
    industry: organization?.industry ?? "",
    notes: organization?.notes ?? "",
  };
}

interface Props {
  /** Edit this organization, or add a new one when left out. */
  organization?: Organization;
  onSaved: (organization: Organization) => void;
  onCancel: () => void;
}

/** R10, R21, R45, R48. Opens in a side panel. */
export function OrganizationForm({ organization, onSaved, onCancel }: Props) {
  const create = useCreateOrganization();
  const update = useUpdateOrganization();
  const offline = useOffline();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(organization),
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    const input = {
      name: values.name.trim(),
      website: optional(values.website),
      industry: optional(values.industry),
      notes: optional(values.notes),
    };
    try {
      const saved = organization
        ? await update.mutateAsync({ id: organization.id, input })
        : await create.mutateAsync(input);
      onSaved(saved);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS, "organization"));
    }
  }

  const saving = isSubmitting || create.isPending || update.isPending;
  return (
    <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Organization">
      <FormError message={formError} />
      <TextField label="Name" error={errors.name?.message} autoComplete="off" {...register("name")} />
      <TextField label="Website" error={errors.website?.message} placeholder="example.com" {...register("website")} />
      <TextField label="Industry" error={errors.industry?.message} {...register("industry")} />
      <TextAreaField label="Notes" error={errors.notes?.message} {...register("notes")} />
      <FormActions
        saving={saving}
        offline={offline}
        saveLabel={organization ? "Save changes" : "Add organization"}
        onCancel={onCancel}
      />
    </form>
  );
}
