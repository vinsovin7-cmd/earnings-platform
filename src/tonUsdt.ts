export const TON_USDT_MASTER_ADDRESS = '0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE';
export const TON_USDT_DECIMALS = 6;

type JettonWallet = {
  balance: string,
  jetton: string,
  owner: string
};

function isJettonWallet(value: unknown): value is JettonWallet {
  if(!value || typeof value !== 'object' ||
    !('balance' in value) || !('jetton' in value) || !('owner' in value)) {
    return false;
  }

  return typeof value.balance === 'string' && /^\d+$/.test(value.balance) &&
    typeof value.jetton === 'string' && typeof value.owner === 'string';
}

function normalizeRawAddress(address: string) {
  const parts = address.split(':');
  if(parts.length !== 2 || !/^-?\d+$/.test(parts[0]) || !/^[\da-fA-F]{64}$/.test(parts[1])) return undefined;
  return `${Number(parts[0])}:${parts[1].toLowerCase()}`;
}

export async function fetchTonUsdtBalance(ownerAddress: string, signal?: AbortSignal) {
  const owner = normalizeRawAddress(ownerAddress);
  if(!owner) throw new Error('TON wallet returned an invalid address.');

  const params = new URLSearchParams({
    owner_address: owner,
    jetton_address: TON_USDT_MASTER_ADDRESS,
    limit: '10'
  });
  const response = await fetch(`https://toncenter.com/api/v3/jetton/wallets?${params}`, {
    headers: {Accept: 'application/json'},
    cache: 'no-store',
    signal
  });
  if(!response.ok) {
    throw new Error(`TON Center balance request failed (${response.status}).`);
  }

  const result: unknown = await response.json();
  if(!result || typeof result !== 'object' || !('jetton_wallets' in result) ||
    !Array.isArray(result.jetton_wallets) || !result.jetton_wallets.every(isJettonWallet)) {
    throw new Error('TON Center returned an invalid jetton balance response.');
  }

  const master = normalizeRawAddress(TON_USDT_MASTER_ADDRESS);
  const wallet = result.jetton_wallets.find((entry) =>
    normalizeRawAddress(entry.owner) === owner &&
    normalizeRawAddress(entry.jetton) === master
  );
  return wallet ? BigInt(wallet.balance) : 0n;
}

export function formatTonUsdtBalance(amount: bigint) {
  const divisor = 10n ** BigInt(TON_USDT_DECIMALS);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(TON_USDT_DECIMALS, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}
