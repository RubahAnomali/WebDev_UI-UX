import { orgEvidenceSchema } from '../../../shared/schemas/auth';
import { TextField } from '../../components/ui/TextField';
import styles from './OrgEvidenceFields.module.css';

export interface OrgValues {
  organizationName: string;
  registrationNumber: string;
  website: string;
  reference: string;
}

export const ORG_ORDER: (keyof OrgValues)[] = ['organizationName', 'registrationNumber', 'website', 'reference'];

/** Same rule as the server: name, registration number, plus a website or a reference. */
export function validateOrg(values: OrgValues): Partial<Record<keyof OrgValues, string>> {
  const result = orgEvidenceSchema.safeParse(values);
  if (result.success) return {};
  const errors: Partial<Record<keyof OrgValues, string>> = {};
  for (const i of result.error.issues) errors[i.path[0] as keyof OrgValues] ??= i.message;
  return errors;
}

interface Props {
  idPrefix: string;
  values: OrgValues;
  errors: Partial<Record<keyof OrgValues, string>>;
  onChange: (key: keyof OrgValues, value: string) => void;
  disabled?: boolean;
}

/** Shelter / rescue verification evidence, used at sign-up and in Account & privacy. */
export function OrgEvidenceFields({ idPrefix, values, errors, onChange, disabled }: Props) {
  return (
    <fieldset className={styles.group} disabled={disabled}>
      <legend className={styles.legend}>About your shelter or rescue</legend>
      <p className={styles.help}>
        We verify every organization before its listings go live. Add your registration number and at least one of a website or a
        reference we can contact.
      </p>
      <TextField
        id={`${idPrefix}-organizationName`}
        label="Shelter or rescue name *"
        autoComplete="organization"
        placeholder="Happy Tails Rescue"
        value={values.organizationName}
        error={errors.organizationName}
        onChange={(e) => onChange('organizationName', e.target.value)}
      />
      <TextField
        id={`${idPrefix}-registrationNumber`}
        label="Registration or charity number *"
        placeholder="e.g. 501(c)(3) EIN or state registration"
        value={values.registrationNumber}
        error={errors.registrationNumber}
        onChange={(e) => onChange('registrationNumber', e.target.value)}
      />
      <TextField
        id={`${idPrefix}-website`}
        label="Website or social page"
        type="url"
        inputMode="url"
        placeholder="https://happytails.org"
        value={values.website}
        error={errors.website}
        onChange={(e) => onChange('website', e.target.value)}
      />
      <TextField
        id={`${idPrefix}-reference`}
        label="A reference we can contact"
        placeholder="Vet clinic or partner rescue, with a phone or email"
        hint="Add a website, a reference, or both."
        value={values.reference}
        error={errors.reference}
        onChange={(e) => onChange('reference', e.target.value)}
      />
    </fieldset>
  );
}
