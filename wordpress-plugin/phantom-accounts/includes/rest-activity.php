<?php
/**
 * /activity — append-only event log. Read from admin UI, written by
 * both the plugin (internal calls) and the Next.js server (via the
 * service token).
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_REST_Activity {

	public static function register_routes() : void {
		$ns = PHANTOM_ACCOUNTS_REST_NS;

		register_rest_route( $ns, '/activity', [
			[
				'methods'             => 'GET',
				'permission_callback' => [ 'Phantom_Accounts_JWT', 'require_user' ],
				'callback'            => [ __CLASS__, 'list_events' ],
			],
			[
				'methods'             => 'POST',
				'permission_callback' => [ 'Phantom_Accounts_REST_Auth', 'permit_service' ],
				'callback'            => [ __CLASS__, 'append_event' ],
			],
		] );
	}

	public static function list_events( WP_REST_Request $req ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_activity';
		$user  = wp_get_current_user();
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, event, payload, created_at FROM {$table} WHERE user_id = %d ORDER BY id DESC LIMIT 100",
			$user->ID
		) );
		return array_map( fn( $r ) => [
			'id'         => (int) $r->id,
			'event'      => $r->event,
			'payload'    => $r->payload ? json_decode( $r->payload, true ) : null,
			'created_at' => $r->created_at,
		], $rows ?: [] );
	}

	public static function append_event( WP_REST_Request $req ) {
		$user_id = (int) $req->get_param( 'user_id' );
		$event   = sanitize_key( (string) $req->get_param( 'event' ) );
		$payload = $req->get_param( 'payload' );
		if ( $user_id <= 0 || ! $event ) {
			return new WP_Error( 'bad_input', 'user_id and event required.', [ 'status' => 400 ] );
		}
		Phantom_Accounts_Activity::log( $user_id, $event, is_array( $payload ) ? $payload : [] );
		return [ 'ok' => true ];
	}
}

class Phantom_Accounts_Activity {
	public static function log( int $user_id, string $event, array $payload = [] ) : void {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_activity';
		$wpdb->insert( $table, [
			'user_id'    => $user_id,
			'event'      => substr( $event, 0, 64 ),
			'payload'    => $payload ? wp_json_encode( $payload ) : null,
			'created_at' => gmdate( 'Y-m-d H:i:s' ),
		] );
	}
}
