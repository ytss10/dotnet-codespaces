<?php
/**
 * Session Hypergrid Synthesizer
 * Creates spatial visualization data for 1M sessions
 */

class SessionHypergridSynthesizer {
    private $db;
    private $gridDimensions = 1000; // 1000x1000 grid for 1M sessions
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
    }
    
    /**
     * Generate hypergrid snapshot
     */
    public function synthesize($blueprints) {
        $totalSessions = count($blueprints);
        
        if ($totalSessions === 0) {
            return $this->getEmptySnapshot();
        }
        
        // Calculate grid dimensions
        $gridSize = $this->calculateOptimalGrid($totalSessions);
        
        // Create tiles
        $tiles = $this->createTiles($blueprints, $gridSize);
        
        // Calculate aggregate metrics
        $metrics = $this->calculateMetrics($blueprints);
        
        return [
            'dimensions' => [
                'rows' => $gridSize['rows'],
                'cols' => $gridSize['cols'],
                'totalCells' => $gridSize['total']
            ],
            'tiles' => $tiles,
            'aggregates' => $metrics,
            'generatedAt' => time(),
            'version' => 1
        ];
    }
    
    /**
     * Calculate optimal grid dimensions
     */
    private function calculateOptimalGrid($sessionCount) {
        if ($sessionCount === 0) {
            return ['rows' => 0, 'cols' => 0, 'total' => 0];
        }
        
        // For 1M sessions, use 1000x1000 grid
        // For smaller counts, use square root approximation
        $sqrt = ceil(sqrt($sessionCount));
        
        $rows = min($sqrt, $this->gridDimensions);
        $cols = min(ceil($sessionCount / $rows), $this->gridDimensions);
        
        return [
            'rows' => $rows,
            'cols' => $cols,
            'total' => $rows * $cols
        ];
    }
    
    /**
     * Create grid tiles
     */
    private function createTiles($blueprints, $gridSize) {
        $tiles = [];
        $sessionsPerTile = ceil(count($blueprints) / $gridSize['total']);
        
        $tileIndex = 0;
        $blueprintChunks = array_chunk($blueprints, max(1, $sessionsPerTile));
        
        foreach ($blueprintChunks as $chunk) {
            $row = floor($tileIndex / $gridSize['cols']);
            $col = $tileIndex % $gridSize['cols'];
            
            $tile = $this->createTile($chunk, $row, $col);
            $tiles[] = $tile;
            
            $tileIndex++;
        }
        
        return $tiles;
    }
    
    /**
     * Create individual tile
     */
    private function createTile($sessions, $row, $col) {
        $statusHistogram = [];
        $proxyCountries = [];
        $replicaSum = 0;
        
        foreach ($sessions as $session) {
            // Count status
            $status = $session['status'] ?? 'draft';
            $statusHistogram[$status] = ($statusHistogram[$status] ?? 0) + 1;
            
            // Count countries
            $country = $session['region'] ?? 'unknown';
            $proxyCountries[$country] = ($proxyCountries[$country] ?? 0) + 1;
            
            // Sum replicas
            $replicaSum += $session['target_replica_count'] ?? 1;
        }
        
        return [
            'position' => ['row' => $row, 'col' => $col],
            'sessionCount' => count($sessions),
            'replicaCount' => $replicaSum,
            'statusHistogram' => $statusHistogram,
            'proxyCountries' => $proxyCountries,
            'dominantStatus' => $this->getDominantKey($statusHistogram),
            'dominantCountry' => $this->getDominantKey($proxyCountries),
            'intensity' => min(1.0, count($sessions) / 100)
        ];
    }
    
    /**
     * Get dominant key from histogram
     */
    private function getDominantKey($histogram) {
        if (empty($histogram)) {
            return null;
        }
        
        arsort($histogram);
        return key($histogram);
    }
    
    /**
     * Calculate aggregate metrics
     */
    private function calculateMetrics($blueprints) {
        $totalReplicas = 0;
        $statusCounts = [];
        $regionCounts = [];
        
        foreach ($blueprints as $blueprint) {
            $totalReplicas += $blueprint['target_replica_count'] ?? 1;
            
            $status = $blueprint['status'] ?? 'draft';
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
            
            $region = $blueprint['region'] ?? 'unknown';
            $regionCounts[$region] = ($regionCounts[$region] ?? 0) + 1;
        }
        
        return [
            'totalSessions' => count($blueprints),
            'totalReplicas' => $totalReplicas,
            'avgReplicasPerSession' => count($blueprints) > 0 ? 
                round($totalReplicas / count($blueprints), 2) : 0,
            'statusDistribution' => $statusCounts,
            'regionDistribution' => $regionCounts
        ];
    }
    
    /**
     * Get empty snapshot
     */
    private function getEmptySnapshot() {
        return [
            'dimensions' => ['rows' => 0, 'cols' => 0, 'totalCells' => 0],
            'tiles' => [],
            'aggregates' => [
                'totalSessions' => 0,
                'totalReplicas' => 0,
                'avgReplicasPerSession' => 0,
                'statusDistribution' => [],
                'regionDistribution' => []
            ],
            'generatedAt' => time(),
            'version' => 1
        ];
    }
}
