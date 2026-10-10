import {fetchTonUsdtBalance, formatTonUsdtBalance, TON_USDT_MASTER_ADDRESS} from '@/tonUsdt';

describe('TON USDt balance formatting', () => {
  it('formats six decimal jetton units without floating-point rounding', () => {
    expect(formatTonUsdtBalance(123456789n)).toBe('123.456789');
    expect(formatTonUsdtBalance(1000000n)).toBe('1');
    expect(formatTonUsdtBalance(1n)).toBe('0.000001');
  });

  it('uses the verified TON USDt master address', () => {
    expect(TON_USDT_MASTER_ADDRESS).toBe('0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE');
  });
});

describe('TON USDt balance lookup', () => {
  const owner = '0:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns the matching USDt balance for the requested owner', async() => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({
      jetton_wallets: [{
        balance: '1250000',
        owner: owner.toLowerCase(),
        jetton: TON_USDT_MASTER_ADDRESS.toLowerCase()
      }]
    }), {status: 200}));

    await expect(fetchTonUsdtBalance(owner)).resolves.toBe(1250000n);
    expect(fetchSpy.mock.calls[0][0]).toContain('owner_address=0%3Aaaaa');
  });

  it('returns zero if the owner has no USDt jetton wallet', async() => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({jetton_wallets: []}), {status: 200}));

    await expect(fetchTonUsdtBalance(owner)).resolves.toBe(0n);
  });

  it('rejects a wallet that does not match the requested owner', async() => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({
      jetton_wallets: [{
        balance: '500',
        owner: '0:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        jetton: TON_USDT_MASTER_ADDRESS
      }]
    }), {status: 200}));

    await expect(fetchTonUsdtBalance(owner)).resolves.toBe(0n);
  });

  it('reports TON Center HTTP errors', async() => {
    fetchSpy.mockResolvedValue(new Response('', {status: 503}));

    await expect(fetchTonUsdtBalance(owner)).rejects.toThrow('TON Center balance request failed (503).');
  });

  it('rejects malformed balance responses', async() => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({jetton_wallets: [{balance: 3}]}), {status: 200}));

    await expect(fetchTonUsdtBalance(owner)).rejects.toThrow('invalid jetton balance response');
  });

  it('rejects invalid owner addresses before requesting a balance', async() => {
    await expect(fetchTonUsdtBalance('invalid')).rejects.toThrow('invalid address');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
