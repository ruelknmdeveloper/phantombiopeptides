<?php
/**
 * /quiz — lead capture for the peptide research quiz.
 *
 * The Next storefront hits this endpoint server-to-server with the
 * shared service token (never called directly from the browser).
 *
 * Body: {
 *   stage:     "started" | "completed",
 *   email:     string   (required),
 *   first_name?, phone?, answers?, consent?,
 *   utm_source?, utm_medium?, utm_campaign?, referrer?,
 *   ip?, user_agent?
 * }
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_REST_Quiz {

	const GUIDE_RESEND_MIN_INTERVAL = DAY_IN_SECONDS;

	public static function register_routes() : void {
		register_rest_route( PHANTOM_ACCOUNTS_REST_NS, '/quiz/lead', [
			'methods'             => 'POST',
			'permission_callback' => [ 'Phantom_Accounts_REST_Auth', 'permit_service' ],
			'callback'            => [ __CLASS__, 'ingest' ],
		] );
	}

	public static function ingest( WP_REST_Request $req ) {
		global $wpdb;
		$table = $wpdb->prefix . 'pl_quiz_leads';

		$email = sanitize_email( (string) $req->get_param( 'email' ) );
		if ( ! is_email( $email ) ) {
			return new WP_Error( 'bad_email', 'Valid email required.', [ 'status' => 400 ] );
		}

		$stage = (string) $req->get_param( 'stage' );
		if ( ! in_array( $stage, [ 'started', 'completed' ], true ) ) {
			return new WP_Error( 'bad_stage', 'Invalid stage.', [ 'status' => 400 ] );
		}

		$answers_raw = $req->get_param( 'answers' );
		$answers_json = null;
		if ( is_array( $answers_raw ) ) {
			// Cap size so a hostile client can't blow up storage.
			$answers_json = substr( wp_json_encode( $answers_raw ), 0, 8000 );
		}

		$now = gmdate( 'Y-m-d H:i:s' );

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, stage, guide_sent_at FROM {$table} WHERE email = %s LIMIT 1",
			$email
		) );

		$data = [
			'email'         => $email,
			'first_name'    => self::str( $req->get_param( 'first_name' ), 120 ),
			'phone'         => self::str( $req->get_param( 'phone' ), 40 ),
			'stage'         => $stage,
			'consent'       => $req->get_param( 'consent' ) ? 1 : 0,
			'utm_source'    => self::str( $req->get_param( 'utm_source' ), 120 ),
			'utm_medium'    => self::str( $req->get_param( 'utm_medium' ), 120 ),
			'utm_campaign'  => self::str( $req->get_param( 'utm_campaign' ), 120 ),
			'referrer'      => self::str( $req->get_param( 'referrer' ), 500 ),
			'created_ip'    => self::str(
				$req->get_param( 'ip' ) ?: Phantom_Accounts_Rate_Limit::client_ip(),
				45
			),
			'user_agent'    => self::str( $req->get_param( 'user_agent' ), 255 ),
			'updated_at'    => $now,
		];
		if ( $answers_json !== null ) {
			$data['answers'] = $answers_json;
		}

		if ( $row ) {
			// Never regress a completed lead back to started.
			if ( $row->stage === 'completed' && $stage === 'started' ) {
				unset( $data['stage'] );
			}
			$wpdb->update( $table, $data, [ 'id' => (int) $row->id ] );
		} else {
			$data['created_at'] = $now;
			$wpdb->insert( $table, $data );
		}

		// Send the guide only on completion, and only if we haven't
		// already sent it recently.
		$pdf_url = self::pdf_url();
		if (
			$stage === 'completed'
			&& $pdf_url
			&& $data['consent']
			&& self::may_send_guide( $row )
		) {
			$sent = Phantom_Accounts_Mail::quiz_guide( $email, $data['first_name'] ?: '', $pdf_url );
			if ( $sent ) {
				$wpdb->update( $table,
					[ 'guide_sent_at' => $now ],
					[ 'email' => $email ]
				);
			}
		}

		return [
			'ok'       => true,
			'pdf_url'  => $stage === 'completed' ? $pdf_url : null,
		];
	}

	private static function may_send_guide( ?object $row ) : bool {
		if ( ! $row || empty( $row->guide_sent_at ) ) return true;
		return strtotime( $row->guide_sent_at . ' UTC' ) < ( time() - self::GUIDE_RESEND_MIN_INTERVAL );
	}

	private static function pdf_url() : ?string {
		$url = trim( (string) get_option( 'phantom_accounts_quiz_pdf_url', '' ) );
		return $url !== '' ? $url : null;
	}

	private static function str( $val, int $max ) : ?string {
		if ( $val === null ) return null;
		$v = sanitize_text_field( (string) $val );
		return $v === '' ? null : substr( $v, 0, $max );
	}
}
