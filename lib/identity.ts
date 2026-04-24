// Identity fields returned in every /bfhl response.
// Defaults below are the real submitter credentials; env vars override for safety.

export const IDENTITY = {
  user_id: process.env.BFHL_USER_ID ?? "noumanshafique_06102003",
  email_id: process.env.BFHL_EMAIL ?? "ns1358@srmist.edu.in",
  college_roll_number: process.env.BFHL_ROLL ?? "RA2311042010047",
} as const;
