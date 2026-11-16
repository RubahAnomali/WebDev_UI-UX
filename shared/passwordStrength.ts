export interface PasswordRule {
  id: 'length' | 'number' | 'symbol';
  label: string;
  met: boolean;
}

export interface PasswordEvaluation {
  /** 0 (empty/very weak) – 4 (strong) */
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Good' | 'Strong password';
  rules: PasswordRule[];
  /** True when every required rule is met. */
  valid: boolean;
}

export const MIN_PASSWORD_LENGTH = 12;

const COMMON = ['password', '123456', 'qwerty', 'letmein', 'welcome', 'pawhaven', 'iloveyou', 'admin'];

export function evaluatePassword(password: string): PasswordEvaluation {
  const rules: PasswordRule[] = [
    { id: 'length', label: `${MIN_PASSWORD_LENGTH}+ characters`, met: password.length >= MIN_PASSWORD_LENGTH },
    { id: 'number', label: 'A number', met: /\d/.test(password) },
    { id: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9\s]/.test(password) },
  ];
  const valid = rules.every((r) => r.met);

  if (!password) return { score: 0, label: 'Too weak', rules, valid };

  let points = rules.filter((r) => r.met).length; // 0–3
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (password.length >= 16) points += 1;

  const lower = password.toLowerCase();
  const isCommon = COMMON.some((c) => lower.includes(c));
  const isRepetitive = /^(.)\1+$/.test(password) || /(.)\1{3,}/.test(password);
  if (isCommon || isRepetitive) points -= 2;

  // A password that doesn't meet the rules can never read as better than "Fair".
  let score = Math.max(1, Math.min(4, points)) as PasswordEvaluation['score'];
  if (!valid) score = Math.min(score, 2) as PasswordEvaluation['score'];
  else score = Math.max(score, 3) as PasswordEvaluation['score'];
  if (valid && (isCommon || isRepetitive)) score = 2;

  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong password'] as const;
  return { score, label: labels[score], rules, valid };
}
