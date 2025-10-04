<?php
/**
 * Realtime Multiplexer
 * Handles SSE (Server-Sent Events) for real-time updates
 */

class RealtimeMultiplexer {
    private $db;
    private $orchestrator;
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
        $this->orchestrator = new HyperOrchestrator();
    }
    
    /**
     * Stream session updates via SSE
     */
    public function streamSessions() {
        // Set headers for SSE
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no'); // Disable nginx buffering
        
        // Disable output buffering
        if (ob_get_level() > 0) {
            ob_end_flush();
        }
        
        // Send initial snapshot
        $this->sendSnapshot();
        
        // Keep connection alive and send updates
        $lastUpdate = time();
        $updateInterval = 2; // Send updates every 2 seconds
        $startTime = time();
        $maxRuntime = 25; // Max 25 seconds for InfinityFree (30s limit - buffer)
        
        while (true) {
            $currentTime = time();
            
            // Check execution time limit
            if ($currentTime - $startTime >= $maxRuntime) {
                $this->sendEvent('timeout', ['message' => 'Stream timeout, reconnect required']);
                break;
            }
            
            if ($currentTime - $lastUpdate >= $updateInterval) {
                $this->sendSnapshot();
                $lastUpdate = $currentTime;
            }
            
            // Send heartbeat
            $this->sendHeartbeat();
            
            // Check if client disconnected
            if (connection_aborted()) {
                break;
            }
            
            // Sleep to prevent CPU overload
            usleep(500000); // 0.5 seconds
        }
    }
    
    /**
     * Send session snapshot
     */
    private function sendSnapshot() {
        try {
            $blueprints = $this->orchestrator->getBlueprintSnapshot();
            $metrics = $this->orchestrator->getGlobalMetrics();
            $hypergrid = $this->orchestrator->getHypergridSnapshot();
            
            $data = [
                'blueprints' => $blueprints,
                'metrics' => $metrics,
                'hypergrid' => $hypergrid,
                'timestamp' => time()
            ];
            
            $this->sendEvent('snapshot', $data);
        } catch (Exception $e) {
            $this->sendEvent('error', ['message' => $e->getMessage()]);
        }
    }
    
    /**
     * Send SSE event
     */
    private function sendEvent($event, $data) {
        echo "event: $event\n";
        echo "data: " . json_encode($data) . "\n\n";
        
        if (ob_get_level() > 0) {
            ob_flush();
        }
        flush();
    }
    
    /**
     * Send heartbeat to keep connection alive
     */
    private function sendHeartbeat() {
        echo ": heartbeat\n\n";
        
        if (ob_get_level() > 0) {
            ob_flush();
        }
        flush();
    }
    
    /**
     * Stream metrics only
     */
    public function streamMetrics() {
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        
        if (ob_get_level() > 0) {
            ob_end_flush();
        }
        
        $lastUpdate = time();
        $startTime = time();
        $maxRuntime = 25; // Max 25 seconds for InfinityFree
        
        while (true) {
            $currentTime = time();
            
            // Check execution time limit
            if ($currentTime - $startTime >= $maxRuntime) {
                $this->sendEvent('timeout', ['message' => 'Metrics stream timeout']);
                break;
            }
            
            if ($currentTime - $lastUpdate >= 1) {
                try {
                    $metrics = $this->orchestrator->getGlobalMetrics();
                    $this->sendEvent('metrics', $metrics);
                } catch (Exception $e) {
                    $this->sendEvent('error', ['message' => $e->getMessage()]);
                }
                $lastUpdate = $currentTime;
            }
            
            if (connection_aborted()) {
                break;
            }
            
            usleep(500000);
        }
    }
}
