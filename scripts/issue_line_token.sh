#!/usr/bin/env bash
set -euo pipefail

echo "Generating JWT with kid=${KID:-} cid=${CID:-}"
node -e "const fs=require('fs');const crypto=require('crypto');const kid=process.env.KID;const cid=process.env.CID;const now=Math.floor(Date.now()/1000);const header={alg:'RS256',typ:'JWT',kid};const payload={iss:cid,sub:cid,aud:'https://api.line.me/',exp:now+1800,token_exp:60*60*24*30};const b64u=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const data=b64u(header)+'.'+b64u(payload);const jwk=JSON.parse(fs.readFileSync('line_assertion_private_jwk.json','utf8'));const key=crypto.createPrivateKey({key:jwk,format:'jwk'});const sig=crypto.createSign('RSA-SHA256').update(data).end().sign(key).toString('base64url');console.log(data+'.'+sig);" > /tmp/line_assertion_jwt.txt

JWT=$(cat /tmp/line_assertion_jwt.txt)

echo "Requesting channel access token..."
curl -sS -X POST https://api.line.me/oauth2/v2.1/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=client_credentials" \
  -d "client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer" \
  -d "client_assertion=${JWT}" \
  -d "client_id=${CID}" \
  -o line_channel_access_token.json

echo "Saved to line_channel_access_token.json"
