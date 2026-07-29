<?php
/**
 * /notifications — customer notification preferences stored as a single
 * JSON blob in usermeta.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_REST_Notifications {

	const META_KEY = 'pl_notification_prefs';

	public static function default_prefs() : array {
		return [
			'order_updates'    => true,
			'back_in_stock'    => true,
			'price_drops'      => false,
			'new_arrivals'     => false,
			'promotions'       => false,
			'newsletter'       => false,
			'channels'         => [
				'email' => true,
				'sms'   => false,
				'push'  => false,
			],
		];
	}

	public static function register_routes() : void {
		$ns = PHANTOM_ACCOUNTS_REST_NS;

		register_rest_route( $ns, '/notifications', [
			[
				'methods'             => 'GET',
				'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
				'callback'            => [ __CLASS__, 'get_prefs' ],
			],
			[
				'methods'             => 'PUT',
				'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
				'callback'            => [ __CLASS__, 'put_prefs' ],
			],
		] );
	}

	public static function get_prefs( WP_REST_Request $req ) {
		$user  = wp_get_current_user();
		$raw   = get_user_meta( $user->ID, self::META_KEY, true );
		$prefs = is_array( $raw ) ? array_merge( self::default_prefs(), $raw ) : self::default_prefs();
		return $prefs;
	}

	public static function put_prefs( WP_REST_Request $req ) {
		$user  = wp_get_current_user();
		$in    = (array) $req->get_json_params();
		$base  = self::default_prefs();
		$next  = [
			'order_updates' => (bool) ( $in['order_updates'] ?? $base['order_updates'] ),
			'back_in_stock' => (bool) ( $in['back_in_stock'] ?? $base['back_in_stock'] ),
			'price_drops'   => (bool) ( $in['price_drops']   ?? $base['price_drops'] ),
			'new_arrivals'  => (bool) ( $in['new_arrivals']  ?? $base['new_arrivals'] ),
			'promotions'    => (bool) ( $in['promotions']    ?? $base['promotions'] ),
			'newsletter'    => (bool) ( $in['newsletter']    ?? $base['newsletter'] ),
			'channels'      => [
				'email' => (bool) ( $in['channels']['email'] ?? $base['channels']['email'] ),
				'sms'   => (bool) ( $in['channels']['sms']   ?? $base['channels']['sms'] ),
				'push'  => (bool) ( $in['channels']['push']  ?? $base['channels']['push'] ),
			],
		];
		update_user_meta( $user->ID, self::META_KEY, $next );
		Phantom_Accounts_Activity::log( $user->ID, 'notifications_updated', [] );
		return $next;
	}
}
