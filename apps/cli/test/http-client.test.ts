import { HttpClient, UndiciHttpClient } from '../src/http-client';

describe('UndiciHttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new UndiciHttpClient();
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });
});
