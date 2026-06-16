// SA ID number validation and info extraction
// Format: YYMMDD SSSS C RR Z
//   YYMMDD = date of birth
//   SSSS   = 0000-4999 female, 5000-9999 male
//   C      = citizenship: 0 = SA citizen, 1 = permanent resident
//   RR     = legacy field (unused)
//   Z      = Luhn check digit

export function validateSAID(id) {
  if (!id || typeof id !== 'string') return { valid: false, error: 'ID number is required' };
  const cleaned = id.replace(/\s/g, '');
  if (!/^\d{13}$/.test(cleaned)) return { valid: false, error: 'Must be exactly 13 digits' };

  // Luhn check — double every even-positioned digit from the right (full 13-digit context)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    let d = parseInt(cleaned[i]);
    if ((13 - i) % 2 === 0) {      // even position from right → double
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const expected = (10 - (sum % 10)) % 10;
  if (expected !== parseInt(cleaned[12])) {
    return { valid: false, error: 'Invalid ID number — check digit is wrong' };
  }

  // Extract date of birth
  const yy = parseInt(cleaned.slice(0, 2));
  const mm = parseInt(cleaned.slice(2, 4));
  const dd = parseInt(cleaned.slice(4, 6));
  const currentYear2d = new Date().getFullYear() % 100;
  const birthYear = yy > currentYear2d ? 1900 + yy : 2000 + yy;

  // Validate the date itself
  const testDate = new Date(birthYear, mm - 1, dd);
  if (testDate.getMonth() !== mm - 1 || testDate.getDate() !== dd || mm < 1 || mm > 12) {
    return { valid: false, error: 'Date of birth in ID number is invalid' };
  }

  const seq         = parseInt(cleaned.slice(6, 10));
  const citizenCode = cleaned[10];
  const gender      = seq >= 5000 ? 'Male' : 'Female';
  const citizenship = citizenCode === '0' ? 'SA Citizen' : 'Permanent Resident';

  const today = new Date();
  const hadBirthdayThisYear = today >= new Date(today.getFullYear(), mm - 1, dd);
  const age = today.getFullYear() - birthYear - (hadBirthdayThisYear ? 0 : 1);
  const dob = `${birthYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  if (age < 18) return { valid: false, error: 'Applicant must be 18 or older' };
  if (age > 100) return { valid: false, error: 'Date of birth appears incorrect' };

  return { valid: true, dob, age, gender, citizenship };
}

export function maskSAID(id) {
  if (!id || id.length !== 13) return id;
  return id.slice(0, 6) + '******' + id.slice(12);
}
