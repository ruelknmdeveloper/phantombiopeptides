<?php
/**
 * Order helpers — the bridge between guest checkouts and customer
 * accounts.
 *
 * Every checkout on the storefront runs as a guest by default (Woo
 * order gets customer_id = 0). When the customer later activates an
 * account via the /thank-you prompt or the emailed set-password link,
 * their past guest orders on the same email need to be reattached.
 * Otherwise the /account/orders dashboard shows nothing and the
 * customer thinks their history is lost.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_Orders {

	/**
	 * Attach every guest order (customer_id = 0) whose billing_email
	 * matches $email to the given $user_id. Returns the count reattached.
	 *
	 * Safe to call more than once — an order that already has a
	 * customer_id is skipped.
	 */
	public static function attach_orphan_orders( int $user_id, string $email ) : int {
		if ( ! function_exists( 'wc_get_orders' ) ) return 0;
		if ( $user_id <= 0 || $email === '' ) return 0;

		$orders = wc_get_orders( [
			'customer_id'  => 0,
			'billing_email' => $email,
			'limit'        => 100,
			'return'       => 'objects',
		] );

		if ( ! is_array( $orders ) ) return 0;

		$count = 0;
		foreach ( $orders as $order ) {
			if ( ! is_a( $order, 'WC_Order' ) ) continue;
			if ( (int) $order->get_customer_id() !== 0 ) continue;

			$order->set_customer_id( $user_id );
			$order->add_order_note( sprintf(
				'Order attached to customer #%d after account activation (billing email match).',
				$user_id
			) );
			$order->save();
			$count++;
		}

		if ( $count > 0 ) {
			Phantom_Accounts_Activity::log( $user_id, 'orders_attached', [
				'count' => $count,
				'email' => $email,
			] );
		}

		return $count;
	}
}
