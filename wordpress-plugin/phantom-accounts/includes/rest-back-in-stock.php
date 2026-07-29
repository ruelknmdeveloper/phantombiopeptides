<?php
/**
 * /back-in-stock subscriptions + fan-out.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_REST_Back_In_Stock {

	public static function register_routes() : void {
		$ns = PHANTOM_ACCOUNTS_REST_NS;

		register_rest_route( $ns, '/back-in-stock', [
			[
				'methods'             => 'GET',
				'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
				'callback'            => [ __CLASS__, 'list_subs' ],
			],
			[
				'methods'             => 'POST',
				'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
				'callback'            => [ __CLASS__, 'subscribe' ],
			],
		] );

		register_rest_route( $ns, '/back-in-stock/(?P<product_id>\d+)', [
			'methods'             => 'DELETE',
			'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
			'callback'            => [ __CLASS__, 'unsubscribe' ],
		] );
	}

	public static function list_subs( WP_REST_Request $req ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_back_in_stock';
		$user  = wp_get_current_user();
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, variation_id, created_at, notified_at FROM {$table} WHERE user_id = %d ORDER BY created_at DESC LIMIT 200",
			$user->ID
		) );
		return [ 'items' => $rows ?: [] ];
	}

	public static function subscribe( WP_REST_Request $req ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_back_in_stock';
		$user  = wp_get_current_user();

		$product_id   = (int) $req->get_param( 'product_id' );
		$variation_id = (int) $req->get_param( 'variation_id' );
		if ( $product_id <= 0 ) {
			return new WP_Error( 'bad_product', 'Invalid product id.', [ 'status' => 400 ] );
		}
		$wpdb->query( $wpdb->prepare(
			"INSERT IGNORE INTO {$table} (user_id, product_id, variation_id, created_at) VALUES (%d, %d, %d, %s)",
			$user->ID, $product_id, $variation_id, gmdate( 'Y-m-d H:i:s' )
		) );

		Phantom_Accounts_Activity::log( $user->ID, 'back_in_stock_subscribed', [
			'product_id' => $product_id,
		] );
		return [ 'ok' => true ];
	}

	public static function unsubscribe( WP_REST_Request $req ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_back_in_stock';
		$user  = wp_get_current_user();
		$wpdb->delete( $table, [
			'user_id'    => $user->ID,
			'product_id' => (int) $req['product_id'],
		] );
		return [ 'ok' => true ];
	}
}

class Phantom_Accounts_Back_In_Stock {
	public static function notify_subscribers( int $product_id ) : void {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_back_in_stock';
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, user_id FROM {$table} WHERE product_id = %d AND notified_at IS NULL",
			$product_id
		) );
		if ( ! $rows ) return;

		foreach ( $rows as $r ) {
			$sent = Phantom_Accounts_Mail::back_in_stock( (int) $r->user_id, $product_id );
			$wpdb->update( $table,
				[ 'notified_at' => gmdate( 'Y-m-d H:i:s' ) ],
				[ 'id' => (int) $r->id ]
			);
			if ( $sent ) {
				Phantom_Accounts_Activity::log( (int) $r->user_id, 'back_in_stock_notified', [
					'product_id' => $product_id,
				] );
			}
		}
	}
}
