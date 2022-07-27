import { apiUrl, authUrl } from "../../../utils/url";
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let username: string = req.body.username;
  if (username === undefined || username.length === 0) {
    return res.status(400).json({
      error: "missing username",
      error_description: "username is required in the body of this request"
    });
  }

  // --- 1. Get client credentials
  const tokenResponse = await fetch(
    `${authUrl().toString()}v1/tenants/${process.env.TENANT_ID}/realms/${process.env.ADMIN_REALM_ID}/applications/${process.env.MGMT_API_APPLICATION_ID}/token`,
    {
      body: (() => {
        let formData = new URLSearchParams();
        formData.append("grant_type", "client_credentials");
        return formData;
      })(),
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${process.env.MGMT_API_CLIENT_ID}:${process.env.MGMT_API_CLIENT_SECRET}`).toString('base64'),
      },
      method: 'POST'
    }
  );

  let tokenResponseJson = await tokenResponse.json();

  if (tokenResponse.status !== 200) {
    return res.status(400).json(tokenResponseJson);
  }

  let accessToken = tokenResponseJson.access_token;

  // --- 2. Create an identity
  const identityResponse = await fetch(
    `${apiUrl().toString()}v1/tenants/${process.env.TENANT_ID}/realms/${process.env.REALM_ID}/identities`,
    {
      body: JSON.stringify({
        identity: {
          display_name: username,
          traits: {
            type: "traits_v0",
            username: username,
            primary_email_address: `${username}@email.com`,
          }
        }
      }),
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      },
      method: 'POST'
    }
  );

  let identityResponseJson = await identityResponse.json();

  if (identityResponse.status !== 200) {
    return res.status(400).json(identityResponseJson);
  }

  let identityId = identityResponseJson.id;

  // --- 3. Get credential binding link for identity
  const credentialBindingLinkResponse = await fetch(
    `${apiUrl().toString()}v1/tenants/${process.env.TENANT_ID}/realms/${process.env.REALM_ID}/identities/${identityId}/credential-binding-jobs`,
    {
      body: JSON.stringify({
        job: {
          delivery_method: "RETURN",
          authenticator_config_id: process.env.AUTHENTICATOR_CONFIG_ID,
          post_binding_redirect_uri: process.env.NEXTAUTH_URL,
        }
      }),
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      },
      method: 'POST'
    }
  );
  let credentialBindingLinkResponseJson = await credentialBindingLinkResponse.json();

  if (credentialBindingLinkResponse.status !== 200) {
    return res.status(400).json(credentialBindingLinkResponseJson);
  }

  res.send(credentialBindingLinkResponseJson);
}
