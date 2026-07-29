<?php
/**
 * Thin JWT helper. Delegates signing/verifying to the Firebase JWT
 * library bundled with the "JWT Authentication for WP REST API" plugin
 * so JWTs we mint are validated by that plugin's request filter (and
 * vice-versa). Both use JWT_AUTH_SECRET_KEY.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_JWT {

	public static function is_available() : bool {
		return class_exists( '\\Firebase\\JWT\\JWT' ) && defined( 'JWT_AUTH_SECRET_KEY' );
	}

	/**
	 * Issue a JWT for the given user, matching the payload shape the
	 * JWT Auth plugin generates so its filter accepts our tokens.
	 */
	public static function issue_for_user( int $user_id, int $ttl_seconds = null ) : ?string {
		if ( ! self::is_available() ) return null;
		$user = get_user_by( 'id', $user_id );
		if ( ! $user ) return null;

		$issued  = time();
		$expires = $issued + ( $ttl_seconds ?? ( 7 * DAY_IN_SECONDS ) );

		$payload = [
			'iss'  => get_bloginfo( 'url' ),
			'iat'  => $issued,
			'nbf'  => $issued,
			'exp'  => $expires,
			'data' => [
				'user' => [ 'id' => (string) $user->ID ],
			],
		];

		$alg = defined( 'JWT_AUTH_ALGORITHM' ) ? JWT_AUTH_ALGORITHM : 'HS256';
		return \Firebase\JWT\JWT::encode( $payload, JWT_AUTH_SECRET_KEY, $alg );
	}

	/**
	 * Guard for REST callbacks that require an authenticated user. The
	 * JWT Auth plugin populates wp_get_current_user() from the Bearer
	 * token automatically, so we only need to check is_user_logged_in().
	 */
	public static function require_user() {
		if ( ! is_user_logged_in() ) {
			return new WP_Error(
				'rest_forbidden',
				'You must be signed in.',
				[ 'status' => 401 ]
			);
		}
		return true;
	}
}
