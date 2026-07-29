<?php
/**
 * Redis-free rate limiter backed by WP transients. Good for low/medium
 * traffic. Uses a per-key sliding window counter.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_Rate_Limit {

	/**
	 * Consume one hit against `$key`. Returns true when allowed, false
	 * when the caller has exceeded `$limit` hits in `$window_seconds`.
	 * Callers should hash user-controlled inputs (email, IP) into $key.
	 */
	public static function check( string $key, int $limit, int $window_seconds ) : bool {
		$transient = 'pl_rl_' . md5( $key );
		$now       = time();
		$data      = get_transient( $transient );

		if ( ! is_array( $data ) || empty( $data['window_start'] ) ) {
			set_transient( $transient, [
				'window_start' => $now,
				'count'        => 1,
			], $window_seconds );
			return true;
		}

		if ( $now - (int) $data['window_start'] >= $window_seconds ) {
			set_transient( $transient, [
				'window_start' => $now,
				'count'        => 1,
			], $window_seconds );
			return true;
		}

		if ( (int) $data['count'] >= $limit ) {
			return false;
		}

		$data['count']++;
		$remaining = $window_seconds - ( $now - (int) $data['window_start'] );
		set_transient( $transient, $data, max( 1, $remaining ) );
		return true;
	}

	public static function client_ip() : string {
		$candidates = [ 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ];
		foreach ( $candidates as $k ) {
			if ( empty( $_SERVER[ $k ] ) ) continue;
			$raw = explode( ',', (string) $_SERVER[ $k ] )[0];
			$ip  = trim( $raw );
			if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) return $ip;
		}
		return '0.0.0.0';
	}
}
