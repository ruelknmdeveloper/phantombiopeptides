<?php
/**
 * /wishlist CRUD.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_REST_Wishlist {

	public static function register_routes() : void {
		$ns = PHANTOM_ACCOUNTS_REST_NS;

		register_rest_route( $ns, '/wishlist', [
			[
				'methods'             => 'GET',
				'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
				'callback'            => [ __CLASS__, 'list_items' ],
			],
			[
				'methods'             => 'POST',
				'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
				'callback'            => [ __CLASS__, 'add' ],
			],
		] );

		register_rest_route( $ns, '/wishlist/(?P<product_id>\d+)', [
			'methods'             => 'DELETE',
			'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
			'callback'            => [ __CLASS__, 'remove' ],
		] );

		register_rest_route( $ns, '/wishlist/merge', [
			'methods'             => 'POST',
			'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
			'callback'            => [ __CLASS__, 'merge' ],
		] );
	}

	public static function list_items( WP_REST_Request $req ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_wishlist';
		$user  = wp_get_current_user();
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, variation_id, added_at FROM {$table} WHERE user_id = %d ORDER BY added_at DESC LIMIT 200",
			$user->ID
		) );
		return [ 'items' => array_map( fn( $r ) => [
			'product_id'   => (int) $r->product_id,
			'variation_id' => (int) $r->variation_id ?: null,
			'added_at'     => $r->added_at,
		], $rows ?: [] ) ];
	}

	public static function add( WP_REST_Request $req ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_wishlist';
		$user  = wp_get_current_user();

		$product_id   = (int) $req->get_param( 'product_id' );
		$variation_id = (int) $req->get_param( 'variation_id' );
		if ( $product_id <= 0 ) {
			return new WP_Error( 'bad_product', 'Invalid product id.', [ 'status' => 400 ] );
		}
		$wpdb->query( $wpdb->prepare(
			"INSERT IGNORE INTO {$table} (user_id, product_id, variation_id, added_at) VALUES (%d, %d, %d, %s)",
			$user->ID, $product_id, $variation_id, gmdate( 'Y-m-d H:i:s' )
		) );

		Phantom_Accounts_Activity::log( $user->ID, 'wishlist_added', [
			'product_id' => $product_id,
		] );
		Phantom_Accounts_Revalidate::ping( [ 'tag' => "user:{$user->ID}:wishlist" ] );
		return [ 'ok' => true ];
	}

	public static function remove( WP_REST_Request $req ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_wishlist';
		$user  = wp_get_current_user();

		$product_id   = (int) $req['product_id'];
		$variation_id = (int) $req->get_param( 'variation_id' );
		$wpdb->delete( $table, [
			'user_id'      => $user->ID,
			'product_id'   => $product_id,
			'variation_id' => $variation_id,
		] );
		Phantom_Accounts_Revalidate::ping( [ 'tag' => "user:{$user->ID}:wishlist" ] );
		return [ 'ok' => true ];
	}

	/**
	 * Union the caller-supplied guest wishlist into the user's saved
	 * one — used the first time a guest signs in with items in
	 * localStorage.
	 */
	public static function merge( WP_REST_Request $req ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_wishlist';
		$user  = wp_get_current_user();

		$items = $req->get_param( 'items' );
		if ( ! is_array( $items ) ) return [ 'ok' => true, 'merged' => 0 ];

		$merged = 0;
		foreach ( array_slice( $items, 0, 200 ) as $item ) {
			$pid = (int) ( $item['product_id'] ?? 0 );
			$vid = (int) ( $item['variation_id'] ?? 0 );
			if ( $pid <= 0 ) continue;
			$wpdb->query( $wpdb->prepare(
				"INSERT IGNORE INTO {$table} (user_id, product_id, variation_id, added_at) VALUES (%d, %d, %d, %s)",
				$user->ID, $pid, $vid, gmdate( 'Y-m-d H:i:s' )
			) );
			if ( $wpdb->rows_affected ) $merged++;
		}
		Phantom_Accounts_Revalidate::ping( [ 'tag' => "user:{$user->ID}:wishlist" ] );
		return [ 'ok' => true, 'merged' => $merged ];
	}
}
