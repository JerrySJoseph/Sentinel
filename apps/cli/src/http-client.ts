import { request } from 'undici';

export interface HttpClient {
    get(url: string): Promise<{ statusCode: number; body: unknown }>;
}

export class UndiciHttpClient implements HttpClient {
    async get(url: string): Promise<{ statusCode: number; body: unknown }> {
        const { statusCode, body } = await request(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        const jsonBody = await body.json();
        return { statusCode, body: jsonBody };
    }
}
