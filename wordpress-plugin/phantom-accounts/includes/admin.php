<?php
/**
 * Tiny WP-admin settings page for the service token, storefront URL,
 * and revalidate URL/secret. Nothing fancy — just enough that ops
 * doesn't have to edit wp-config.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'admin_menu', function () {
	add_options_page(
		'Phantom Accounts',
		'Phantom Accounts',
		'manage_options',
		'phantom-accounts',
		'phantom_accounts_render_settings'
	);
} );

add_action( 'admin_init', function () {
	register_setting( 'phantom_accounts', 'phantom_accounts_service_token' );
	register_setting( 'phantom_accounts', 'phantom_accounts_storefront_url' );
	register_setting( 'phantom_accounts', 'phantom_accounts_revalidate_url' );
	register_setting( 'phantom_accounts', 'phantom_accounts_revalidate_secret' );
	register_setting( 'phantom_accounts', 'phantom_accounts_quiz_pdf_url' );
} );

function phantom_accounts_render_settings() : void {
	if ( ! current_user_can( 'manage_options' ) ) return;
	?>
	<div class="wrap">
		<h1>Phantom Accounts</h1>
		<form method="post" action="options.php">
			<?php settings_fields( 'phantom_accounts' ); ?>
			<table class="form-table">
				<tr>
					<th scope="row"><label for="phantom_accounts_storefront_url">Storefront URL</label></th>
					<td><input type="url" class="regular-text" id="phantom_accounts_storefront_url"
						name="phantom_accounts_storefront_url"
						value="<?php echo esc_attr( get_option( 'phantom_accounts_storefront_url' ) ); ?>"
						placeholder="https://phantombiopeptides.com" />
						<p class="description">Used in transactional email links (e.g. https://…/account/setup?token=…).</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="phantom_accounts_service_token">Service token</label></th>
					<td><input type="text" class="regular-text code" id="phantom_accounts_service_token"
						name="phantom_accounts_service_token"
						value="<?php echo esc_attr( get_option( 'phantom_accounts_service_token' ) ); ?>" />
						<p class="description">Long random string. Set the same value in the Next.js env as <code>PHANTOM_SERVICE_TOKEN</code>. Used to authorise server-to-server calls to <code>/auth/register</code> and <code>/activity</code>.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="phantom_accounts_revalidate_url">Revalidate URL</label></th>
					<td><input type="url" class="regular-text" id="phantom_accounts_revalidate_url"
						name="phantom_accounts_revalidate_url"
						value="<?php echo esc_attr( get_option( 'phantom_accounts_revalidate_url' ) ); ?>"
						placeholder="https://phantombiopeptides.com/api/revalidate" /></td>
				</tr>
				<tr>
					<th scope="row"><label for="phantom_accounts_revalidate_secret">Revalidate secret</label></th>
					<td><input type="text" class="regular-text code" id="phantom_accounts_revalidate_secret"
						name="phantom_accounts_revalidate_secret"
						value="<?php echo esc_attr( get_option( 'phantom_accounts_revalidate_secret' ) ); ?>" />
						<p class="description">Matches <code>REVALIDATE_SECRET</code> in the Next.js env.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="phantom_accounts_quiz_pdf_url">Quiz Guide PDF URL</label></th>
					<td><input type="url" class="regular-text" id="phantom_accounts_quiz_pdf_url"
						name="phantom_accounts_quiz_pdf_url"
						value="<?php echo esc_attr( get_option( 'phantom_accounts_quiz_pdf_url' ) ); ?>"
						placeholder="https://phantombiopeptides.com/wp-content/uploads/…/guide.pdf" />
						<p class="description">Upload the guide to <em>Media</em>, then paste its URL here. Emailed to quiz completers and shown on the /quiz thank-you screen.</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

add_action( 'admin_menu', function () {
	add_management_page(
		'Phantom Activity Log',
		'Phantom Activity',
		'manage_woocommerce',
		'phantom-activity',
		'phantom_accounts_render_activity'
	);
	add_management_page(
		'Phantom Quiz Leads',
		'Phantom Quiz Leads',
		'manage_woocommerce',
		'phantom-quiz-leads',
		'phantom_accounts_render_quiz_leads'
	);
} );

function phantom_accounts_render_activity() : void {
	if ( ! current_user_can( 'manage_woocommerce' ) ) return;
	global $wpdb;
	$table = $wpdb->prefix . 'pl_activity';
	$q     = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : '';
	$rows  = $q
		? $wpdb->get_results( $wpdb->prepare(
			"SELECT a.*, u.user_email FROM {$table} a
			  LEFT JOIN {$wpdb->users} u ON u.ID = a.user_id
			  WHERE u.user_email LIKE %s OR a.event LIKE %s
			  ORDER BY a.id DESC LIMIT 200",
			'%' . $wpdb->esc_like( $q ) . '%',
			'%' . $wpdb->esc_like( $q ) . '%'
		) )
		: $wpdb->get_results( "SELECT a.*, u.user_email FROM {$table} a LEFT JOIN {$wpdb->users} u ON u.ID = a.user_id ORDER BY a.id DESC LIMIT 200" );
	?>
	<div class="wrap">
		<h1>Phantom Activity Log</h1>
		<form method="get">
			<input type="hidden" name="page" value="phantom-activity" />
			<input type="search" name="q" value="<?php echo esc_attr( $q ); ?>" placeholder="email or event" />
			<?php submit_button( 'Search', 'secondary', '', false ); ?>
		</form>
		<table class="widefat striped" style="margin-top:1em">
			<thead><tr>
				<th>When</th><th>User</th><th>Event</th><th>Payload</th>
			</tr></thead>
			<tbody>
			<?php foreach ( $rows ?: [] as $r ) : ?>
				<tr>
					<td><?php echo esc_html( $r->created_at ); ?></td>
					<td><?php echo esc_html( $r->user_email ?: '#' . $r->user_id ); ?></td>
					<td><code><?php echo esc_html( $r->event ); ?></code></td>
					<td><pre style="white-space:pre-wrap;margin:0"><?php echo esc_html( $r->payload ?: '' ); ?></pre></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>
	</div>
	<?php
}

function phantom_accounts_render_quiz_leads() : void {
	if ( ! current_user_can( 'manage_woocommerce' ) ) return;
	global $wpdb;
	$table = $wpdb->prefix . 'pl_quiz_leads';

	$q      = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : '';
	$stage  = isset( $_GET['stage'] ) ? sanitize_text_field( wp_unslash( $_GET['stage'] ) ) : '';
	$export = isset( $_GET['export'] ) && $_GET['export'] === 'csv';

	$where = [ '1=1' ];
	$args  = [];
	if ( $q !== '' ) {
		$where[] = '(email LIKE %s OR first_name LIKE %s OR phone LIKE %s)';
		$like    = '%' . $wpdb->esc_like( $q ) . '%';
		array_push( $args, $like, $like, $like );
	}
	if ( in_array( $stage, [ 'started', 'completed' ], true ) ) {
		$where[] = 'stage = %s';
		$args[]  = $stage;
	}
	$sql   = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . " ORDER BY id DESC LIMIT 500";
	$rows  = $args ? $wpdb->get_results( $wpdb->prepare( $sql, $args ) ) : $wpdb->get_results( $sql );

	$counts = $wpdb->get_row( "SELECT
		COUNT(*)                                       AS total,
		SUM(stage='completed')                         AS completed,
		SUM(stage='started')                           AS started,
		SUM(guide_sent_at IS NOT NULL)                 AS sent
		FROM {$table}"
	);

	if ( $export ) {
		nocache_headers();
		header( 'Content-Type: text/csv; charset=UTF-8' );
		header( 'Content-Disposition: attachment; filename="phantom-quiz-leads.csv"' );
		$out = fopen( 'php://output', 'w' );
		fputcsv( $out, [ 'id','email','first_name','phone','stage','consent','answers','utm_source','utm_medium','utm_campaign','referrer','created_ip','user_agent','guide_sent_at','created_at','updated_at' ] );
		foreach ( $rows ?: [] as $r ) {
			fputcsv( $out, [
				$r->id, $r->email, $r->first_name, $r->phone,
				$r->stage, $r->consent, $r->answers,
				$r->utm_source, $r->utm_medium, $r->utm_campaign, $r->referrer,
				$r->created_ip, $r->user_agent,
				$r->guide_sent_at, $r->created_at, $r->updated_at,
			] );
		}
		fclose( $out );
		exit;
	}
	?>
	<div class="wrap">
		<h1>
			Phantom Quiz Leads
			<a href="?page=phantom-quiz-leads&export=csv<?php echo $q ? '&q=' . urlencode( $q ) : ''; ?><?php echo $stage ? '&stage=' . urlencode( $stage ) : ''; ?>"
			   class="page-title-action">Export CSV</a>
		</h1>
		<p>
			<strong><?php echo (int) $counts->total; ?></strong> total ·
			<strong><?php echo (int) $counts->completed; ?></strong> completed ·
			<strong><?php echo (int) $counts->started; ?></strong> started only ·
			<strong><?php echo (int) $counts->sent; ?></strong> guides emailed
		</p>
		<form method="get" style="margin:12px 0">
			<input type="hidden" name="page" value="phantom-quiz-leads" />
			<input type="search" name="q" value="<?php echo esc_attr( $q ); ?>" placeholder="email, name, or phone" />
			<select name="stage">
				<option value="">All stages</option>
				<option value="started"   <?php selected( $stage, 'started' ); ?>>Started only</option>
				<option value="completed" <?php selected( $stage, 'completed' ); ?>>Completed</option>
			</select>
			<?php submit_button( 'Filter', 'secondary', '', false ); ?>
		</form>
		<table class="widefat striped">
			<thead><tr>
				<th>When</th><th>Email</th><th>Name / Phone</th>
				<th>Stage</th><th>Consent</th><th>Guide sent</th>
				<th>Answers</th>
			</tr></thead>
			<tbody>
			<?php foreach ( $rows ?: [] as $r ) :
				$answers = $r->answers ? json_decode( $r->answers, true ) : null;
			?>
				<tr>
					<td><?php echo esc_html( $r->created_at ); ?><br>
						<small><?php echo esc_html( $r->updated_at ); ?></small></td>
					<td><?php echo esc_html( $r->email ); ?></td>
					<td><?php echo esc_html( $r->first_name ); ?><br>
						<small><?php echo esc_html( $r->phone ); ?></small></td>
					<td><?php echo esc_html( $r->stage ); ?></td>
					<td><?php echo $r->consent ? '✓' : '—'; ?></td>
					<td><?php echo $r->guide_sent_at ? esc_html( $r->guide_sent_at ) : '—'; ?></td>
					<td><details><summary><?php echo is_array( $answers ) ? count( $answers ) . ' answers' : '—'; ?></summary>
						<pre style="white-space:pre-wrap;margin:6px 0 0"><?php echo esc_html( wp_json_encode( $answers, JSON_PRETTY_PRINT ) ); ?></pre>
					</details></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>
	</div>
	<?php
}
