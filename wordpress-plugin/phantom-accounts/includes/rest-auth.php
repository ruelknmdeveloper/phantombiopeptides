<?php
/**
 * Auth endpoints: register (post-purchase), set-password, request-reset,
 * reset, magic-link/request, magic-link/consume, verify-email.
 *
 * Login-with-password lives in the JWT Auth plugin at
 *   POST /wp-json/jwt-auth/v1/token
 * — Next calls it directly for email+password.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_REST_Auth {

	public static function register_routes() : void {
		$ns = PHANTOM_ACCOUNTS_REST_NS;

		register_rest_route( $ns, '/auth/register', [
			'methods'             => 'POST',
			'permission_callback' => [ __CLASS__, 'permit_service' ],
			'callback'            => [ __CLASS__, 'register_after_purchase' ],
		] );

		register_rest_route( $ns, '/auth/set-password', [
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => [ __CLASS__, 'set_password' ],
		] );

		register_rest_route( $ns, '/auth/request-reset', [
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => [ __CLASS__, 'request_reset' ],
		] );

		register_rest_route( $ns, '/auth/reset', [
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => [ __CLASS__, 'reset' ],
		] );

		register_rest_route( $ns, '/auth/magic-link/request', [
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => [ __CLASS__, 'magic_link_request' ],
		] );

		register_rest_route( $ns, '/auth/magic-link/consume', [
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => [ __CLASS__, 'magic_link_consume' ],
		] );

		register_rest_route( $ns, '/auth/verify-email', [
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => [ __CLASS__, 'verify_email' ],
		] );

		register_rest_route( $ns, '/auth/register-and-set-password', [
			'methods'             => 'POST',
			'permission_callback' => [ __CLASS__, 'permit_service' ],
			'callback'            => [ __CLASS__, 'register_and_set_password' ],
		] );
	}

	/**
	 * Only the Next.js server (holding the shared service token) may
	 * call /auth/register. Set the same value in WP admin and in the
	 * Next env as PHANTOM_SERVICE_TOKEN.
	 */
	public static function permit_service( WP_REST_Request $req ) : bool {
		$hdr      = $req->get_header( 'x-phantom-service-token' );
		$expected = (string) get_option( 'phantom_accounts_service_token', '' );
		return $expected !== '' && hash_equals( $expected, (string) $hdr );
	}

	public static function register_after_purchase( WP_REST_Request $req ) {
		$email = sanitize_email( (string) $req->get_param( 'email' ) );
		$first = sanitize_text_field( (string) $req->get_param( 'first_name' ) );
		$last  = sanitize_text_field( (string) $req->get_param( 'last_name' ) );
		if ( ! is_email( $email ) ) {
			return new WP_Error( 'bad_email', 'Valid email required.', [ 'status' => 400 ] );
		}

		$user = get_user_by( 'email', $email );
		if ( ! $user ) {
			$uid = wp_insert_user( [
				'user_login'   => $email,
				'user_email'   => $email,
				'user_pass'    => wp_generate_password( 32, true, true ),
				'first_name'   => $first,
				'last_name'    => $last,
				'display_name' => trim( $first . ' ' . $last ) ?: $email,
				'role'         => 'customer',
			] );
			if ( is_wp_error( $uid ) ) return $uid;
			$user = get_user_by( 'id', $uid );
		}

		update_user_meta( $user->ID, 'pl_source', 'checkout' );

		// Issue set-password token so the customer can activate on their
		// own time — no password chosen at checkout.
		$token = Phantom_Accounts_Tokens::issue(
			$user->ID,
			Phantom_Accounts_Tokens::TYPE_SET_PASSWORD,
			Phantom_Accounts_Rate_Limit::client_ip()
		);
		Phantom_Accounts_Mail::set_password( $user->ID, $token );

		Phantom_Accounts_Activity::log( $user->ID, 'account_created', [
			'source' => 'post_purchase',
		] );

		return [
			'ok'      => true,
			'user_id' => $user->ID,
		];
	}

	public static function set_password( WP_REST_Request $req ) {
		$rl = 'set_pw:' . Phantom_Accounts_Rate_Limit::client_ip();
		if ( ! Phantom_Accounts_Rate_Limit::check( $rl, 10, HOUR_IN_SECONDS ) ) {
			return new WP_Error( 'rate_limited', 'Too many attempts.', [ 'status' => 429 ] );
		}

		$token    = (string) $req->get_param( 'token' );
		$password = (string) $req->get_param( 'password' );
		if ( strlen( $password ) < 10 ) {
			return new WP_Error( 'weak_password', 'Use at least 10 characters.', [ 'status' => 400 ] );
		}

		$user_id = Phantom_Accounts_Tokens::consume( $token, Phantom_Accounts_Tokens::TYPE_SET_PASSWORD );
		if ( is_wp_error( $user_id ) ) return $user_id;

		wp_set_password( $password, (int) $user_id );
		update_user_meta( (int) $user_id, 'pl_email_verified_at', gmdate( 'c' ) );

		$jwt = Phantom_Accounts_JWT::issue_for_user( (int) $user_id );
		if ( ! $jwt ) {
			return new WP_Error( 'jwt_unavailable', 'JWT plugin unavailable.', [ 'status' => 500 ] );
		}

		Phantom_Accounts_Activity::log( (int) $user_id, 'password_set', [] );

		return [ 'ok' => true, 'token' => $jwt ];
	}

	public static function request_reset( WP_REST_Request $req ) {
		$email = sanitize_email( (string) $req->get_param( 'email' ) );

		// Rate limit by email + IP so this can't be used for enumeration
		// or mail-bombing.
		$rl = 'reset:' . md5( $email . '|' . Phantom_Accounts_Rate_Limit::client_ip() );
		if ( ! Phantom_Accounts_Rate_Limit::check( $rl, 3, HOUR_IN_SECONDS ) ) {
			return new WP_Error( 'rate_limited', 'Too many attempts.', [ 'status' => 429 ] );
		}

		$user = is_email( $email ) ? get_user_by( 'email', $email ) : null;
		if ( $user ) {
			$token = Phantom_Accounts_Tokens::issue(
				$user->ID,
				Phantom_Accounts_Tokens::TYPE_RESET,
				Phantom_Accounts_Rate_Limit::client_ip()
			);
			Phantom_Accounts_Mail::password_reset( $user->ID, $token );
		}

		// Always return ok — never leak whether an email is registered.
		return [ 'ok' => true ];
	}

	public static function reset( WP_REST_Request $req ) {
		$token    = (string) $req->get_param( 'token' );
		$password = (string) $req->get_param( 'password' );
		if ( strlen( $password ) < 10 ) {
			return new WP_Error( 'weak_password', 'Use at least 10 characters.', [ 'status' => 400 ] );
		}

		$user_id = Phantom_Accounts_Tokens::consume( $token, Phantom_Accounts_Tokens::TYPE_RESET );
		if ( is_wp_error( $user_id ) ) return $user_id;

		wp_set_password( $password, (int) $user_id );
		Phantom_Accounts_Activity::log( (int) $user_id, 'password_reset', [] );

		$jwt = Phantom_Accounts_JWT::issue_for_user( (int) $user_id );
		return [ 'ok' => true, 'token' => $jwt ];
	}

	public static function magic_link_request( WP_REST_Request $req ) {
		$email = sanitize_email( (string) $req->get_param( 'email' ) );

		$rl = 'magic:' . md5( $email . '|' . Phantom_Accounts_Rate_Limit::client_ip() );
		if ( ! Phantom_Accounts_Rate_Limit::check( $rl, 5, HOUR_IN_SECONDS ) ) {
			return new WP_Error( 'rate_limited', 'Too many attempts.', [ 'status' => 429 ] );
		}

		$user = is_email( $email ) ? get_user_by( 'email', $email ) : null;
		if ( $user ) {
			$token = Phantom_Accounts_Tokens::issue(
				$user->ID,
				Phantom_Accounts_Tokens::TYPE_MAGIC_LINK,
				Phantom_Accounts_Rate_Limit::client_ip()
			);
			Phantom_Accounts_Mail::magic_link( $user->ID, $token );
		}

		return [ 'ok' => true ];
	}

	public static function magic_link_consume( WP_REST_Request $req ) {
		$token   = (string) $req->get_param( 'token' );
		$user_id = Phantom_Accounts_Tokens::consume( $token, Phantom_Accounts_Tokens::TYPE_MAGIC_LINK );
		if ( is_wp_error( $user_id ) ) return $user_id;

		Phantom_Accounts_Activity::log( (int) $user_id, 'signin', [ 'method' => 'magic_link' ] );

		$jwt = Phantom_Accounts_JWT::issue_for_user( (int) $user_id );
		if ( ! $jwt ) {
			return new WP_Error( 'jwt_unavailable', 'JWT plugin unavailable.', [ 'status' => 500 ] );
		}
		return [ 'ok' => true, 'token' => $jwt ];
	}

	public static function verify_email( WP_REST_Request $req ) {
		$token   = (string) $req->get_param( 'token' );
		$user_id = Phantom_Accounts_Tokens::consume( $token, Phantom_Accounts_Tokens::TYPE_VERIFY_EMAIL );
		if ( is_wp_error( $user_id ) ) return $user_id;

		update_user_meta( (int) $user_id, 'pl_email_verified_at', gmdate( 'c' ) );
		return [ 'ok' => true ];
	}

	/**
	 * Combined register + set-password for the /thank-you inline
	 * activation prompt. Customer just finished checkout, chose to
	 * save their info, and typed a password on the spot — so we
	 * skip the whole email-token dance and issue a JWT immediately.
	 *
	 * Called server-to-server from Next (service token required).
	 * Body: { email, first_name, last_name, password, marketing_consent? }
	 */
	public static function register_and_set_password( WP_REST_Request $req ) {
		$email    = sanitize_email( (string) $req->get_param( 'email' ) );
		$first    = sanitize_text_field( (string) $req->get_param( 'first_name' ) );
		$last     = sanitize_text_field( (string) $req->get_param( 'last_name' ) );
		$password = (string) $req->get_param( 'password' );
		$marketing = (bool) $req->get_param( 'marketing_consent' );

		if ( ! is_email( $email ) ) {
			return new WP_Error( 'bad_email', 'Valid email required.', [ 'status' => 400 ] );
		}
		if ( strlen( $password ) < 10 ) {
			return new WP_Error( 'weak_password', 'Use at least 10 characters.', [ 'status' => 400 ] );
		}

		$user = get_user_by( 'email', $email );
		if ( ! $user ) {
			$uid = wp_insert_user( [
				'user_login'   => $email,
				'user_email'   => $email,
				'user_pass'    => $password,
				'first_name'   => $first,
				'last_name'    => $last,
				'display_name' => trim( $first . ' ' . $last ) ?: $email,
				'role'         => 'customer',
			] );
			if ( is_wp_error( $uid ) ) return $uid;
			$user = get_user_by( 'id', $uid );
		} else {
			// Existing customer — respect their choice by resetting the
			// password to what they just typed. They may have forgotten
			// they already have an account.
			wp_set_password( $password, $user->ID );
		}

		update_user_meta( $user->ID, 'pl_source', 'thank_you_prompt' );
		update_user_meta( $user->ID, 'pl_email_verified_at', gmdate( 'c' ) );
		if ( $marketing ) {
			update_user_meta( $user->ID, 'pl_marketing_consent', 1 );
			update_user_meta( $user->ID, 'pl_marketing_consent_at', gmdate( 'c' ) );
		}

		Phantom_Accounts_Activity::log( $user->ID, 'account_created', [
			'source'            => 'thank_you_prompt',
			'marketing_consent' => $marketing ? 1 : 0,
		] );

		$jwt = Phantom_Accounts_JWT::issue_for_user( $user->ID );
		if ( ! $jwt ) {
			return new WP_Error( 'jwt_unavailable', 'JWT plugin unavailable.', [ 'status' => 500 ] );
		}

		return [
			'ok'      => true,
			'user_id' => $user->ID,
			'token'   => $jwt,
		];
	}
}
