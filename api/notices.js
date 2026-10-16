import { readFileSync } from 'node:fs';
import { createLoginVerifier } from '../src/verify-login.mjs';
import { makeResourceId } from '../src/resource-id.mjs';
const config = JSON.parse(
    readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8')
);

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');

    if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        return response.status(405).json({
            error: 'METHOD_NOT_ALLOWED'
        });
    }
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseSecretKey) {
        return response.status(500).json({
            error: 'SERVER_CONFIGURATION_MISSING'
        });
    }

    let verified;

    try {
        const verifyLogin = createLoginVerifier({
            config,
            supabaseSecretKey
        });

        verified = await verifyLogin(request.headers?.authorization);
    } catch {
        return response.status(500).json({
            error: 'LOGIN_VERIFIER_UNAVAILABLE'
        });
    }

    if (!verified) {
        return response.status(401).json({
            error: 'UNAUTHORIZED'
        });
    }

    return response.status(200).json({
        resourceId: makeResourceId('notice', 'list'),
        notices: []
    });
}