const PKCE_VERIFIER_KEY = 'notes-pkce-verifier'
const PKCE_STATE_KEY = 'notes-pkce-state'

type CognitoOidcConfig = {
  domain: string
  clientId: string
  redirectUri: string
  logoutUri: string
  scopes: string
}

type TokenResponse = {
  access_token: string
  id_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
}

const getConfig = (): CognitoOidcConfig => {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI
  const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI ?? window.location.origin
  const scopes = import.meta.env.VITE_COGNITO_SCOPES ?? 'openid email profile'

  if (!domain || !clientId || !redirectUri) {
    throw new Error('Cognito OIDC 設定が不足しています (.env を確認してください)')
  }

  return { domain, clientId, redirectUri, logoutUri, scopes }
}

const base64UrlEncode = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  let str = ''
  bytes.forEach((byte) => {
    str += String.fromCharCode(byte)
  })
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const createCodeVerifier = () => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array.buffer)
}

const createCodeChallenge = async (verifier: string) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

const createState = () => {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return base64UrlEncode(array.buffer)
}

export const startCognitoLogin = async () => {
  const { domain, clientId, redirectUri, scopes } = getConfig()
  if (typeof window === 'undefined') return

  const verifier = createCodeVerifier()
  const challenge = await createCodeChallenge(verifier)
  const state = createState()

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
  sessionStorage.setItem(PKCE_STATE_KEY, state)

  const authorizeUrl = new URL(`https://${domain}/oauth2/authorize`)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('scope', scopes)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('code_challenge', challenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')
  authorizeUrl.searchParams.set('state', state)

  window.location.assign(authorizeUrl.toString())
}

const decodeJwtPayload = <T>(token: string): T => {
  const [, payload] = token.split('.')
  if (!payload) {
    throw new Error('Invalid token payload')
  }
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const decoded = atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='))
  return JSON.parse(decoded) as T
}

export const completeCognitoLogin = async (code: string, returnedState?: string) => {
  const { domain, clientId, redirectUri } = getConfig()
  if (typeof window === 'undefined') throw new Error('Window is not available')

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)
  const expectedState = sessionStorage.getItem(PKCE_STATE_KEY)
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
  sessionStorage.removeItem(PKCE_STATE_KEY)

  if (!verifier) {
    throw new Error('PKCE verifier が見つかりません。もう一度ログインしてください。')
  }
  if (expectedState && returnedState && expectedState !== returnedState) {
    throw new Error('state が一致しません。もう一度ログインしてください。')
  }

  const tokenEndpoint = `https://${domain}/oauth2/token`
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  })

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${text}`)
  }

  const tokenData = (await response.json()) as TokenResponse
  const payload = decodeJwtPayload<Record<string, unknown>>(tokenData.id_token)
  const userId = (payload.sub as string) ?? (payload['cognito:username'] as string)
  const username =
    (payload['cognito:username'] as string) ??
    (payload['preferred_username'] as string) ??
    (payload['email'] as string) ??
    'user'

  return {
    userId,
    accessToken: tokenData.access_token,
    idToken: tokenData.id_token,
    refreshToken: tokenData.refresh_token,
    username,
  }
}

export const startCognitoLogout = () => {
  if (typeof window === 'undefined') return
  const { domain, clientId, logoutUri } = getConfig()
  const logoutUrl = new URL(`https://${domain}/logout`)
  logoutUrl.searchParams.set('client_id', clientId)
  logoutUrl.searchParams.set('logout_uri', logoutUri)
  window.location.assign(logoutUrl.toString())
}
