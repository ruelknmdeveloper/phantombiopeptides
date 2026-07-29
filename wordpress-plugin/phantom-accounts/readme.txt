=== Phantom Accounts ===
Contributors: phantomlabs
Requires at least: 6.4
Tested up to: 6.7
Requires PHP: 8.0
Stable tag: 0.1.0
License: GPLv2 or later

Headless customer-account layer for the Phantom Labs Next.js storefront.

== Description ==

Provides the endpoints and storage the Next.js front-end needs to run
customer accounts on top of WordPress + WooCommerce as the single
source of truth:

* /wp-json/phantom/v1/auth/*        register (post-purchase), set-password,
                                    request-reset, reset, magic-link,
                                    verify-email
* /wp-json/phantom/v1/me            GET / PATCH profile + prefs + addresses
* /wp-json/phantom/v1/wishlist      GET / POST / DELETE / merge
* /wp-json/phantom/v1/notifications GET / PUT
* /wp-json/phantom/v1/back-in-stock GET / POST / DELETE + auto fan-out
* /wp-json/phantom/v1/activity      GET (user-scoped) / POST (service token)

Password login is delegated to the JWT Authentication for WP REST API
plugin at /wp-json/jwt-auth/v1/token.

== Requirements ==

* WooCommerce
* JWT Authentication for WP REST API (Enrique Chavez)
* `JWT_AUTH_SECRET_KEY` defined in wp-config.php
* WP Mail SMTP or FluentSMTP (recommended, for Resend/Postmark delivery)

== Installation ==

1. Copy the plugin folder to `wp-content/plugins/phantom-accounts/`.
2. Activate. The plugin creates tables `wp_pl_auth_tokens`,
   `wp_pl_wishlist`, `wp_pl_back_in_stock`, `wp_pl_activity`.
3. Go to Settings → Phantom Accounts and set the storefront URL,
   service token, and revalidate URL/secret.
4. Add the JWT plugin's required config to wp-config.php:
   `define( 'JWT_AUTH_SECRET_KEY', 'your-long-random-string' );`
   `define( 'JWT_AUTH_CORS_ENABLE', true );`

== Changelog ==

= 0.1.0 =
* Initial release.
