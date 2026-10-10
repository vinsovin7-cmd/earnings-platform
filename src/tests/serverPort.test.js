import resolvePort from '../../serverPort';

describe('standalone server port resolution', () => {
  it('uses the normal default port', () => {
    expect(resolvePort(undefined, undefined, false)).toBe(8080);
  });

  it('preserves the third-tour default port', () => {
    expect(resolvePort(undefined, undefined, true)).toBe(8443);
  });

  it('uses PORT when no positional port is provided', () => {
    expect(resolvePort(undefined, '9080', false)).toBe(9080);
  });

  it('uses PORT before the third-tour default', () => {
    expect(resolvePort(undefined, '9082', true)).toBe(9082);
  });

  it('prefers an explicit positional port over PORT', () => {
    expect(resolvePort('9081', '9080', true)).toBe(9081);
  });
});
