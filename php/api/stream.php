<?php
/**
 * SSE Streaming Endpoint
 * Real-time session updates via Server-Sent Events
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/realtime-multiplexer.php';

$multiplexer = new RealtimeMultiplexer();
$multiplexer->streamSessions();
