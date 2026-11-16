import type { SelectOption } from '../../components/ui/Select';

export const SPECIES_OPTIONS: SelectOption[] = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'small', label: 'Small pet (rabbit, guinea pig…)' },
  { value: 'bird', label: 'Bird & more' },
];
export const SEX_OPTIONS: SelectOption[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'unknown', label: 'Unknown' },
];
export const AGE_UNIT_OPTIONS: SelectOption[] = [
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
];
export const SIZE_OPTIONS: SelectOption[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'extra_large', label: 'Extra large' },
];
export const LISTING_TYPE_OPTIONS: SelectOption[] = [
  { value: 'adoption', label: 'Adoption (shelter / rescue)' },
  { value: 'rehoming', label: 'Responsible rehoming' },
];
export const TRISTATE_OPTIONS: SelectOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
];
export const ENERGY_OPTIONS: SelectOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];
export const GOOD_WITH_OPTIONS = [
  { value: 'adults', label: 'Adults' },
  { value: 'children', label: 'Children' },
  { value: 'dogs', label: 'Dogs' },
  { value: 'cats', label: 'Cats' },
] as const;

export const labelOf = (options: SelectOption[], value: string | null | undefined) =>
  options.find((o) => o.value === value)?.label.replace(/ \(.*\)$/, '') ?? '';
