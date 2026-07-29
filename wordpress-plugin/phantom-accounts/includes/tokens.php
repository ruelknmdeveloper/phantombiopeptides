<?php
/**
 * One-time auth tokens: set-password, reset, magic-link, verify-email.
 *
 * We store SHA-256 hashes of the token, never the raw token. The raw
 * token is returned once to the caller (so it can be emailed) and then
 * discarded.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_Tokens {

	const TYPE_SET_PASSWORD = 'set_password';
	const TYPE_RESET        = 'reset';
	const TYPE_MAGIC_LINK   = 'magic_link';
	const TYPE_VERIFY_EMAIL = 'verify_email';

	const TTL_SET_PASSWORD = 7 * DAY_IN_SECONDS;
	const TTL_RESET        = 10 * MINUTE_IN_SECONDS;
	const TTL_MAGIC_LINK   = 15 * MINUTE_IN_SECONDS;
	const TTL_VERIFY_EMAIL = 2 * DAY_IN_SECONDS;

	public static function issue( int $user_id, string $type, ?string $ip = null ) : string {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_auth_tokens';

		self::purge_active( $user_id, $type );

		$raw  = wp_generate_password( 48, false, false );
		$hash = hash( 'sha256', $raw );
		$ttl  = self::ttl_for( $type );

		$wpdb->insert( $table, [
			'user_id'    => $user_id,
			'type'       => $type,
			'token_hash' => $hash,
			'expires_at' => gmdate( 'Y-m-d H:i:s', time() + $ttl ),
			'created_at' => gmdate( 'Y-m-d H:i:s' ),
			'created_ip' => $ip ? substr( $ip, 0, 45 ) : null,
		] );

		return $raw;
	}

	/**
	 * Look up a raw token, mark it consumed, return the user_id. Returns
	 * WP_Error on any failure (not found, expired, wrong type, already
	 * consumed). Constant-time comparison via hash().
	 */
	public static function consume( string $raw, string $type ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_auth_tokens';

		if ( ! $raw || strlen( $raw ) < 32 ) {
			return new WP_Error( 'invalid_token', 'Invalid token.', [ 'status' => 400 ] );
		}
		$hash = hash( 'sha256', $raw );

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, user_id, type, expires_at, consumed_at
			   FROM {$table}
			  WHERE token_hash = %s
			  LIMIT 1",
			$hash
		) );

		if ( ! $row ) {
			return new WP_Error( 'invalid_token', 'Invalid token.', [ 'status' => 400 ] );
		}
		if ( $row->type !== $type ) {
			return new WP_Error( 'invalid_token', 'Invalid token.', [ 'status' => 400 ] );
		}
		if ( $row->consumed_at ) {
			return new WP_Error( 'token_consumed', 'This link has already been used.', [ 'status' => 400 ] );
		}
		if ( strtotime( $row->expires_at . ' UTC' ) < time() ) {
			return new WP_Error( 'token_expired', 'This link has expired.', [ 'status' => 400 ] );
		}

		$wpdb->update( $table,
			[ 'consumed_at' => gmdate( 'Y-m-d H:i:s' ) ],
			[ 'id' => (int) $row->id ]
		);

		return (int) $row->user_id;
	}

	/** Wipe any un-consumed active tokens of this type for this user. */
	public static function purge_active( int $user_id, string $type ) : void {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_auth_tokens';
		$wpdb->query( $wpdb->prepare(
			"UPDATE {$table} SET consumed_at = %s
			  WHERE user_id = %d AND type = %s AND consumed_at IS NULL",
			gmdate( 'Y-m-d H:i:s' ),
			$user_id,
			$type
		) );
	}

	private static function ttl_for( string $type ) : int {
		return match ( $type ) {
			self::TYPE_SET_PASSWORD => self::TTL_SET_PASSWORD,
			self::TYPE_RESET        => self::TTL_RESET,
			self::TYPE_MAGIC_LINK   => self::TTL_MAGIC_LINK,
			self::TYPE_VERIFY_EMAIL => self::TTL_VERIFY_EMAIL,
			default                 => 15 * MINUTE_IN_SECONDS,
		};
	}
}
