// Deployed backend (stack eaom-site-admin). Public values only: no secrets live here.
// redirectUri must exactly match a callback/logout URL registered on the Cognito app client:
//   https://eyeassociatesofmiami.com/adminportal/  and  http://localhost:5188/adminportal/
export const apiUrl = 'https://pj6vomnlq7.execute-api.us-east-1.amazonaws.com';
export const authDomain = 'https://eaom-admin-875953.auth.us-east-1.amazoncognito.com';
export const clientId = '7ai1k9322hlt3gk68suqr226h9';
export const redirectUri = location.origin + '/adminportal/';

// Friendly names for the change log / "changed this" messages. Unknown emails show
// the part before @, capitalized.
// To add someone: run  node -e "import('./adminportal/names.js').then(m=>console.log(m.emailKey('THEIR EMAIL')))"
// and add  'h:xxxxxxxx': 'Dr. Walls'  (Dr. Walls isn't listed yet).
export const adminNames = { 'h:9a3dd186': 'Dr. Gray' };   // keyed by names.js emailKey(email): no emails in this public file

export default { apiUrl, authDomain, clientId, redirectUri, adminNames };
