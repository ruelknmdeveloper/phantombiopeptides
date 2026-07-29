<?php
/**
 * /me — the "everything you need to render the account shell in one
 * request" endpoint. Returns Woo customer PII + prefs + verification
 * status so the storefront doesn't have to fan out.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_REST_Me {

	public static function register_routes() : void {
		$ns = PHANTOM_ACCOUNTS_REST_NS;

		register_rest_route( $ns, '/me', [
			[
				'methods'             => 'GET',
				'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
				'callback'            => [ __CLASS__, 'get_me' ],
			],
			[
				'methods'             => 'PATCH',
				'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
				'callback'            => [ __CLASS__, 'patch_me' ],
			],
		] );
	}

	public static function get_me( WP_REST_Request $req ) {
		$user = wp_get_current_user();
		return self::shape( $user );
	}

	public static function patch_me( WP_REST_Request $req ) {
		$user = wp_get_current_user();
		$data = [];

		$first = $req->get_param( 'first_name' );
		$last  = $req->get_param( 'last_name' );
		$phone = $req->get_param( 'phone' );
		if ( is_string( $first ) ) $data['first_name'] = sanitize_text_field( $first );
		if ( is_string( $last ) )  $data['last_name']  = sanitize_text_field( $last );
		if ( ! empty( $data ) ) {
			$data['ID'] = $user->ID;
			wp_update_user( $data );
		}
		if ( is_string( $phone ) ) {
			update_user_meta( $user->ID, 'billing_phone', sanitize_text_field( $phone ) );
		}

		// Marketing consent, birthday, preferred language.
		foreach ( [ 'pl_marketing_consent', 'pl_birthday', 'pl_preferred_language' ] as $meta_key ) {
			$val = $req->get_param( $meta_key );
			if ( $val !== null ) {
				update_user_meta( $user->ID, $meta_key, is_bool( $val ) ? (int) $val : sanitize_text_field( (string) $val ) );
			}
		}

		Phantom_Accounts_Activity::log( $user->ID, 'profile_updated', [] );

		return self::shape( wp_get_current_user() );
	}

	private static function shape( WP_User $user ) : array {
		$customer = function_exists( 'wc_get_customer_last_order' ) ? new WC_Customer( $user->ID ) : null;
		return [
			'id'          => $user->ID,
			'email'       => $user->user_email,
			'first_name'  => $user->first_name,
			'last_name'   => $user->last_name,
			'display_name'=> $user->display_name,
			'email_verified_at' => get_user_meta( $user->ID, 'pl_email_verified_at', true ) ?: null,
			'phone'       => get_user_meta( $user->ID, 'billing_phone', true ) ?: null,
			'birthday'    => get_user_meta( $user->ID, 'pl_birthday', true ) ?: null,
			'preferred_language' => get_user_meta( $user->ID, 'pl_preferred_language', true ) ?: null,
			'marketing_consent'  => (bool) get_user_meta( $user->ID, 'pl_marketing_consent', true ),
			'billing'     => $customer ? [
				'first_name' => $customer->get_billing_first_name(),
				'last_name'  => $customer->get_billing_last_name(),
				'company'    => $customer->get_billing_company(),
				'address_1'  => $customer->get_billing_address_1(),
				'address_2'  => $customer->get_billing_address_2(),
				'city'       => $customer->get_billing_city(),
				'state'      => $customer->get_billing_state(),
				'postcode'   => $customer->get_billing_postcode(),
				'country'    => $customer->get_billing_country(),
				'email'      => $customer->get_billing_email(),
				'phone'      => $customer->get_billing_phone(),
			] : null,
			'shipping'    => $customer ? [
				'first_name' => $customer->get_shipping_first_name(),
				'last_name'  => $customer->get_shipping_last_name(),
				'company'    => $customer->get_shipping_company(),
				'address_1'  => $customer->get_shipping_address_1(),
				'address_2'  => $customer->get_shipping_address_2(),
				'city'       => $customer->get_shipping_city(),
				'state'      => $customer->get_shipping_state(),
				'postcode'   => $customer->get_shipping_postcode(),
				'country'    => $customer->get_shipping_country(),
			] : null,
		];
	}
}
