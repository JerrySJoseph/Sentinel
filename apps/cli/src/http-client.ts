import { request } from 'undici';

export interface HttpClient {
    get(url: string): Promise<{ statusCode: number; body: unknown }>;
    post(url: string, body: unknown): Promise<{ statusCode: number; body: unknown }>;
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

    async post(url: string, requestBody: unknown): Promise<{ statusCode: number; body: unknown }> {
        const { statusCode, body } = await request(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        const jsonBody = await body.json();
        return { statusCode, body: jsonBody };
    }
}
