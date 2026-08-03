<?php
/**
 * Plugin Name:       Phantom Accounts
 * Plugin URI:        https://phantombiopeptides.com
 * Description:       Headless-friendly customer account layer for the Next.js storefront. Wishlist, notification prefs, magic-link + set-password token flow, and CRM activity log — all backed by WordPress/WooCommerce as the single source of truth.
 * Version:           0.2.0
 * Requires at least: 6.4
 * Requires PHP:      8.0
 * Author:            Phantom Labs
 * License:           GPL-2.0-or-later
 * Text Domain:       phantom-accounts
 *
 * Requires: WooCommerce, JWT Authentication for WP REST API (Enrique Chavez).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PHANTOM_ACCOUNTS_VERSION', '0.2.0' );
define( 'PHANTOM_ACCOUNTS_FILE', __FILE__ );
define( 'PHANTOM_ACCOUNTS_DIR', plugin_dir_path( __FILE__ ) );
define( 'PHANTOM_ACCOUNTS_REST_NS', 'phantom/v1' );

require_once PHANTOM_ACCOUNTS_DIR . 'includes/schema.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/tokens.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/rate-limit.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/jwt.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/mail.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/rest-auth.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/rest-me.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/rest-wishlist.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/rest-notifications.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/rest-back-in-stock.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/rest-activity.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/rest-quiz.php';
require_once PHANTOM_ACCOUNTS_DIR . 'includes/admin.php';

register_activation_hook( __FILE__, [ 'Phantom_Accounts_Schema', 'install' ] );

add_action( 'rest_api_init', function () {
	Phantom_Accounts_REST_Auth::register_routes();
	Phantom_Accounts_REST_Me::register_routes();
	Phantom_Accounts_REST_Wishlist::register_routes();
	Phantom_Accounts_REST_Notifications::register_routes();
	Phantom_Accounts_REST_Back_In_Stock::register_routes();
	Phantom_Accounts_REST_Activity::register_routes();
	Phantom_Accounts_REST_Quiz::register_routes();
} );

add_action( 'admin_notices', function () {
	if ( ! current_user_can( 'activate_plugins' ) ) return;
	$missing = [];
	if ( ! class_exists( 'WooCommerce' ) ) $missing[] = 'WooCommerce';
	if ( ! function_exists( 'jwt_auth_init' ) && ! class_exists( 'Jwt_Auth' ) ) {
		$missing[] = 'JWT Authentication for WP REST API';
	}
	if ( $missing ) {
		echo '<div class="notice notice-error"><p><strong>Phantom Accounts</strong> requires the following plugins to be active: ' . esc_html( implode( ', ', $missing ) ) . '.</p></div>';
	}
	if ( ! defined( 'JWT_AUTH_SECRET_KEY' ) ) {
		echo '<div class="notice notice-error"><p><strong>Phantom Accounts</strong>: <code>JWT_AUTH_SECRET_KEY</code> is not defined in <code>wp-config.php</code>. Auth endpoints will fail until it is set.</p></div>';
	}
} );

/**
 * When a Woo order is paid, fire a hook the storefront can listen for
 * and log it to activity. Also emit the shape our /api/revalidate
 * endpoint expects so per-user caches invalidate.
 */
add_action( 'woocommerce_order_status_processing', function ( $order_id ) {
	$order = wc_get_order( $order_id );
	if ( ! $order ) return;
	$user_id = (int) $order->get_customer_id();
	if ( $user_id > 0 ) {
		Phantom_Accounts_Activity::log( $user_id, 'order_completed', [
			'order_id' => $order_id,
			'total'    => (float) $order->get_total(),
			'currency' => $order->get_currency(),
		] );
	}
	Phantom_Accounts_Revalidate::ping( [
		'tag'  => $user_id ? "user:{$user_id}:orders" : null,
		'path' => "/thank-you",
	] );
}, 10, 1 );

/**
 * Notify subscribers when a product transitions from out-of-stock →
 * in-stock.
 */
add_action( 'woocommerce_product_set_stock_status', function ( $product_id, $stock_status, $product ) {
	if ( $stock_status !== 'instock' ) return;
	Phantom_Accounts_Back_In_Stock::notify_subscribers( (int) $product_id );
}, 10, 3 );

/**
 * Tiny helper class so hooks can fire a POST to the Next.js
 * /api/revalidate endpoint. Non-blocking; failures logged but not
 * surfaced.
 */
class Phantom_Accounts_Revalidate {
	public static function ping( array $body ) : void {
		$url    = get_option( 'phantom_accounts_revalidate_url' );
		$secret = get_option( 'phantom_accounts_revalidate_secret' );
		if ( ! $url || ! $secret ) return;
		wp_remote_post( add_query_arg( 'secret', $secret, $url ), [
			'timeout'  => 3,
			'blocking' => false,
			'headers'  => [ 'Content-Type' => 'application/json' ],
			'body'     => wp_json_encode( array_filter( $body, fn( $v ) => $v !== null ) ),
		] );
	}
}
