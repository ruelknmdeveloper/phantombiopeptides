<?php
/**
 * Transactional email templates for account-lifecycle events. Uses
 * wp_mail(), so plugins like WP Mail SMTP / FluentSMTP that route
 * WordPress mail through Resend or Postmark will apply automatically.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_Mail {

	public static function set_password( int $user_id, string $token ) : bool {
		$user = get_user_by( 'id', $user_id );
		if ( ! $user ) return false;
		$url = self::site_url( '/account/setup', [ 'token' => $token ] );

		$subject = 'Set up your ' . get_bloginfo( 'name' ) . ' account';
		$body    = self::render( "Welcome,\n\nYour order is confirmed. Set a password to access your account, order history, and saved details:\n\n{$url}\n\nThis link expires in 7 days. If you didn't just place an order, ignore this email." );
		return self::send( $user->user_email, $subject, $body );
	}

	public static function magic_link( int $user_id, string $token ) : bool {
		$user = get_user_by( 'id', $user_id );
		if ( ! $user ) return false;
		$url = self::site_url( '/login/magic', [ 'token' => $token ] );

		$subject = 'Your sign-in link';
		$body    = self::render( "Sign in to " . get_bloginfo( 'name' ) . " by opening this link on the same device you requested it from:\n\n{$url}\n\nThis link expires in 15 minutes and can only be used once." );
		return self::send( $user->user_email, $subject, $body );
	}

	public static function password_reset( int $user_id, string $token ) : bool {
		$user = get_user_by( 'id', $user_id );
		if ( ! $user ) return false;
		$url = self::site_url( '/account/reset', [ 'token' => $token ] );

		$subject = 'Reset your password';
		$body    = self::render( "We received a request to reset your password. If it was you, use this link:\n\n{$url}\n\nThis link expires in 10 minutes." );
		return self::send( $user->user_email, $subject, $body );
	}

	public static function verify_email( int $user_id, string $token, string $email ) : bool {
		$url = self::site_url( '/account/verify', [ 'token' => $token ] );
		$subject = 'Verify your email';
		$body    = self::render( "Confirm this email address for your account:\n\n{$url}\n\nExpires in 2 days." );
		return self::send( $email, $subject, $body );
	}

	public static function quiz_guide( string $to, string $first_name, string $pdf_url ) : bool {
		$greeting = $first_name !== '' ? "Hi {$first_name}," : "Hi there,";
		$subject  = "Your Researcher's Field Guide";
		$body     = self::render(
			"{$greeting}\n\n" .
			"Thanks for taking the quiz. Here's your Researcher's Field Guide to Peptide Handling:\n\n" .
			"{$pdf_url}\n\n" .
			"Bookmark the link — it'll always be here if you want to revisit it. If you have a specific compound you're researching, our catalog is at " .
			home_url( '/shop' ) . "."
		);
		return self::send( $to, $subject, $body );
	}

	public static function back_in_stock( int $user_id, int $product_id ) : bool {
		$user    = get_user_by( 'id', $user_id );
		$product = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
		if ( ! $user || ! $product ) return false;
		$slug    = method_exists( $product, 'get_slug' ) ? $product->get_slug() : '';
		$url     = self::site_url( '/product/' . $slug );
		$name    = $product->get_name();
		$subject = "Back in stock: {$name}";
		$body    = self::render( "{$name} is back in stock.\n\nShop it here before it's gone:\n\n{$url}" );
		return self::send( $user->user_email, $subject, $body );
	}

	private static function send( string $to, string $subject, string $body ) : bool {
		$headers = [
			'Content-Type: text/plain; charset=UTF-8',
			'From: ' . get_bloginfo( 'name' ) . ' <' . get_option( 'admin_email' ) . '>',
		];
		return (bool) wp_mail( $to, $subject, $body, $headers );
	}

	private static function render( string $body ) : string {
		return $body . "\n\n— " . get_bloginfo( 'name' );
	}

	private static function site_url( string $path, array $query = [] ) : string {
		$base = rtrim( (string) get_option( 'phantom_accounts_storefront_url', home_url() ), '/' );
		$url  = $base . $path;
		if ( $query ) $url .= ( str_contains( $url, '?' ) ? '&' : '?' ) . http_build_query( $query );
		return $url;
	}
}
