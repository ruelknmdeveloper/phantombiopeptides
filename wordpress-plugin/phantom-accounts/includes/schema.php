<?php
/**
 * Custom-table schema. Runs on plugin activation via dbDelta().
 * Idempotent — safe to re-run.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Phantom_Accounts_Schema {
	public static function install() : void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();

		$tables = [];

		// One-time auth tokens: set-password, reset, magic-link, verify.
		$tables[] = "CREATE TABLE {$wpdb->prefix}pl_auth_tokens (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			type VARCHAR(32) NOT NULL,
			token_hash CHAR(64) NOT NULL,
			expires_at DATETIME NOT NULL,
			consumed_at DATETIME NULL,
			created_at DATETIME NOT NULL,
			created_ip VARCHAR(45) NULL,
			PRIMARY KEY (id),
			UNIQUE KEY token_hash (token_hash),
			KEY user_type (user_id, type),
			KEY expires_at (expires_at)
		) {$charset};";

		// Wishlist: one row per (user, product, variation).
		$tables[] = "CREATE TABLE {$wpdb->prefix}pl_wishlist (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			product_id BIGINT UNSIGNED NOT NULL,
			variation_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
			added_at DATETIME NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY user_product_variation (user_id, product_id, variation_id),
			KEY product (product_id)
		) {$charset};";

		// Back-in-stock notifications: user wants to know when this
		// product is restocked.
		$tables[] = "CREATE TABLE {$wpdb->prefix}pl_back_in_stock (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			product_id BIGINT UNSIGNED NOT NULL,
			variation_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			notified_at DATETIME NULL,
			PRIMARY KEY (id),
			UNIQUE KEY user_product_variation (user_id, product_id, variation_id),
			KEY product (product_id)
		) {$charset};";

		// CRM activity log, append-only. Payload is JSON.
		$tables[] = "CREATE TABLE {$wpdb->prefix}pl_activity (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			event VARCHAR(64) NOT NULL,
			payload LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY (id),
			KEY user_event (user_id, event),
			KEY created_at (created_at)
		) {$charset};";

		// Quiz lead capture. One row per email (upsert), so re-taking
		// the quiz overwrites the previous answers. Guide send is
		// throttled by guide_sent_at so a rapid re-submit does not
		// email-bomb the lead.
		$tables[] = "CREATE TABLE {$wpdb->prefix}pl_quiz_leads (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			email VARCHAR(190) NOT NULL,
			first_name VARCHAR(120) NULL,
			phone VARCHAR(40) NULL,
			stage VARCHAR(16) NOT NULL DEFAULT 'started',
			answers LONGTEXT NULL,
			consent TINYINT(1) NOT NULL DEFAULT 0,
			utm_source VARCHAR(120) NULL,
			utm_medium VARCHAR(120) NULL,
			utm_campaign VARCHAR(120) NULL,
			referrer VARCHAR(500) NULL,
			created_ip VARCHAR(45) NULL,
			user_agent VARCHAR(255) NULL,
			guide_sent_at DATETIME NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY email (email),
			KEY stage (stage),
			KEY created_at (created_at)
		) {$charset};";

		foreach ( $tables as $sql ) {
			dbDelta( $sql );
		}
	}
}
