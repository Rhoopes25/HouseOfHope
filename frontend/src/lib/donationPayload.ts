/** Matches donor portal conversion — amounts stored in PHP for parity with `/Donations/my`. */
export const TO_PHP_RATE: Record<'PHP' | 'USD' | 'EUR', number> = {
  PHP: 1,
  USD: 56,
  EUR: 61,
};

export type UiDonationType = 'monetary' | 'time' | 'in-kind' | 'skills' | 'social-media';

export function mapUiTypeToApi(donationTypeRaw: string): string {
  const map: Record<string, string> = {
    monetary: 'Monetary',
    'in-kind': 'InKind',
    time: 'Time',
    skills: 'Skills',
    'social-media': 'SocialMedia',
  };
  return map[donationTypeRaw] ?? donationTypeRaw;
}

export function buildAdminDonationBody({
  donationTypeUi,
  donationDate,
  amountInput,
  inputCurrency,
  campaignName,
  notes,
}: {
  donationTypeUi: UiDonationType;
  donationDate: string;
  amountInput: number;
  inputCurrency: 'PHP' | 'USD' | 'EUR';
  campaignName: string;
  notes?: string;
}): {
  donationType: string;
  donationDate: string;
  amount?: number;
  estimatedValue?: number;
  currencyCode?: string;
  campaignName?: string;
  notes?: string;
} {
  const trimmedNotes = notes?.trim() || undefined;
  const trimmedCampaign = campaignName.trim() || 'Admin Portal';
  const phpValue = amountInput * TO_PHP_RATE[inputCurrency];

  switch (donationTypeUi) {
    case 'time':
      return {
        donationType: 'Time',
        donationDate,
        estimatedValue: amountInput,
        notes: trimmedNotes,
        campaignName: trimmedCampaign,
      };
    case 'in-kind':
    case 'skills':
    case 'social-media':
      return {
        donationType: mapUiTypeToApi(donationTypeUi),
        donationDate,
        estimatedValue: phpValue,
        currencyCode: 'PHP',
        notes: trimmedNotes,
        campaignName: trimmedCampaign,
      };
    case 'monetary':
    default:
      return {
        donationType: 'Monetary',
        donationDate,
        amount: phpValue,
        currencyCode: 'PHP',
        notes: trimmedNotes,
        campaignName: trimmedCampaign,
      };
  }
}
