<?php
declare(strict_types=1);

/**
 * Structured Logger - PSR-3 Compatible Advanced Logging System
 * 
 * Provides structured, queryable logging with context and metadata support.
 * Replaces basic error_log() with production-grade logging capabilities.
 * 
 * @package MegaWebOrchestrator
 * @version 2.0
 */

namespace MegaWeb\Core;

use DateTimeImmutable;
use DateTimeZone;
use Throwable;

final class StructuredLogger
{
    private const LEVEL_EMERGENCY = 'emergency';
    private const LEVEL_ALERT = 'alert';
    private const LEVEL_CRITICAL = 'critical';
    private const LEVEL_ERROR = 'error';
    private const LEVEL_WARNING = 'warning';
    private const LEVEL_NOTICE = 'notice';
    private const LEVEL_INFO = 'info';
    private const LEVEL_DEBUG = 'debug';

    private const LEVELS = [
        self::LEVEL_EMERGENCY => 800,
        self::LEVEL_ALERT => 700,
        self::LEVEL_CRITICAL => 600,
        self::LEVEL_ERROR => 500,
        self::LEVEL_WARNING => 400,
        self::LEVEL_NOTICE => 300,
        self::LEVEL_INFO => 200,
        self::LEVEL_DEBUG => 100,
    ];

    private string $logPath;
    private string $minimumLevel;
    private bool $enableJsonFormat;
    private array $globalContext;

    public function __construct(
        string $logPath = '/tmp/megaweb.log',
        string $minimumLevel = self::LEVEL_INFO,
        bool $enableJsonFormat = true
    ) {
        $this->logPath = $logPath;
        $this->minimumLevel = $minimumLevel;
        $this->enableJsonFormat = $enableJsonFormat;
        $this->globalContext = [
            'hostname' => gethostname(),
            'pid' => getmypid(),
            'php_version' => PHP_VERSION,
        ];
    }

    /**
     * System is unusable
     */
    public function emergency(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_EMERGENCY, $message, $context);
    }

    /**
     * Action must be taken immediately
     */
    public function alert(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_ALERT, $message, $context);
    }

    /**
     * Critical conditions
     */
    public function critical(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_CRITICAL, $message, $context);
    }

    /**
     * Runtime errors that don't require immediate action
     */
    public function error(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_ERROR, $message, $context);
    }

    /**
     * Exceptional occurrences that are not errors
     */
    public function warning(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_WARNING, $message, $context);
    }

    /**
     * Normal but significant events
     */
    public function notice(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_NOTICE, $message, $context);
    }

    /**
     * Interesting events
     */
    public function info(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_INFO, $message, $context);
    }

    /**
     * Detailed debug information
     */
    public function debug(string $message, array $context = []): void
    {
        $this->log(self::LEVEL_DEBUG, $message, $context);
    }

    /**
     * Log an exception with full stack trace
     */
    public function exception(Throwable $exception, string $message = '', array $context = []): void
    {
        $context['exception'] = [
            'class' => get_class($exception),
            'message' => $exception->getMessage(),
            'code' => $exception->getCode(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $this->formatStackTrace($exception->getTrace()),
        ];

        $logMessage = $message ?: 'Uncaught exception: ' . $exception->getMessage();
        $this->log(self::LEVEL_ERROR, $logMessage, $context);
    }

    /**
     * Core logging method
     */
    private function log(string $level, string $message, array $context = []): void
    {
        if (!$this->shouldLog($level)) {
            return;
        }

        $timestamp = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        
        $logEntry = [
            'timestamp' => $timestamp->format('Y-m-d\TH:i:s.u\Z'),
            'level' => $level,
            'message' => $this->interpolate($message, $context),
            'context' => array_merge($this->globalContext, $context),
            'memory_usage' => memory_get_usage(true),
            'memory_peak' => memory_get_peak_usage(true),
        ];

        $formattedMessage = $this->enableJsonFormat
            ? json_encode($logEntry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL
            : $this->formatPlainText($logEntry);

        $this->write($formattedMessage);
    }

    /**
     * Check if message should be logged based on level
     */
    private function shouldLog(string $level): bool
    {
        return self::LEVELS[$level] >= self::LEVELS[$this->minimumLevel];
    }

    /**
     * Interpolate context values into message placeholders
     */
    private function interpolate(string $message, array $context): string
    {
        $replacements = [];
        
        foreach ($context as $key => $value) {
            if (is_null($value) || is_scalar($value) || (is_object($value) && method_exists($value, '__toString'))) {
                $replacements["{{$key}}"] = $value;
            } elseif (is_array($value) || is_object($value)) {
                $replacements["{{$key}}"] = json_encode($value);
            }
        }

        return strtr($message, $replacements);
    }

    /**
     * Format log entry as plain text
     */
    private function formatPlainText(array $logEntry): string
    {
        $contextStr = !empty($logEntry['context']) 
            ? ' | ' . json_encode($logEntry['context'])
            : '';

        return sprintf(
            "[%s] %s: %s%s\n",
            $logEntry['timestamp'],
            strtoupper($logEntry['level']),
            $logEntry['message'],
            $contextStr
        );
    }

    /**
     * Format stack trace for logging
     */
    private function formatStackTrace(array $trace): array
    {
        return array_map(function ($frame) {
            return [
                'file' => $frame['file'] ?? 'unknown',
                'line' => $frame['line'] ?? 0,
                'function' => $frame['function'] ?? 'unknown',
                'class' => $frame['class'] ?? null,
                'type' => $frame['type'] ?? null,
            ];
        }, array_slice($trace, 0, 10)); // Limit to 10 frames
    }

    /**
     * Write log entry to file
     */
    private function write(string $message): void
    {
        // Atomic write with file locking
        $fp = fopen($this->logPath, 'a');
        if ($fp === false) {
            return; // Fail silently if can't open log file
        }

        if (flock($fp, LOCK_EX)) {
            fwrite($fp, $message);
            flock($fp, LOCK_UN);
        }

        fclose($fp);
    }

    /**
     * Add global context that appears in all log entries
     */
    public function withContext(array $context): self
    {
        $logger = clone $this;
        $logger->globalContext = array_merge($this->globalContext, $context);
        return $logger;
    }

    /**
     * Rotate log file if it exceeds size limit
     */
    public function rotateIfNeeded(int $maxSizeBytes = 10485760): void // 10MB default
    {
        if (!file_exists($this->logPath)) {
            return;
        }

        $fileSize = filesize($this->logPath);
        if ($fileSize === false || $fileSize < $maxSizeBytes) {
            return;
        }

        $backupPath = $this->logPath . '.' . date('Y-m-d_H-i-s') . '.bak';
        rename($this->logPath, $backupPath);
        
        // Keep only last 5 backup files
        $this->cleanupOldBackups();
    }

    /**
     * Clean up old backup log files
     */
    private function cleanupOldBackups(): void
    {
        $pattern = $this->logPath . '.*.bak';
        $backups = glob($pattern);
        
        if ($backups === false || count($backups) <= 5) {
            return;
        }

        usort($backups, function ($a, $b) {
            return filemtime($a) <=> filemtime($b);
        });

        $toDelete = array_slice($backups, 0, count($backups) - 5);
        array_map('unlink', $toDelete);
    }
}

/**
 * Global logger instance factory
 */
function logger(): StructuredLogger
{
    static $instance = null;
    
    if ($instance === null) {
        $logPath = defined('APP_LOG_PATH') ? APP_LOG_PATH : '/tmp/megaweb.log';
        $level = defined('APP_DEBUG') && APP_DEBUG ? 'debug' : 'info';
        $instance = new StructuredLogger($logPath, $level);
    }
    
    return $instance;
}
