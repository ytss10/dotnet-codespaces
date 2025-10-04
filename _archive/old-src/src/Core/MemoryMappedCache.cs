using System;
using System.IO;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;
using System.Threading;
using System.Collections.Concurrent;

namespace MultiSiteLoader.Core
{
    public unsafe class MemoryMappedCache : IDisposable
    {
        private readonly MemoryMappedFile _mmf;
        private readonly MemoryMappedViewAccessor _accessor;
        private readonly byte* _basePtr;
        private readonly long _capacity;
        private readonly ConcurrentDictionary<string, CacheEntry> _index;
        private long _currentOffset;

        public MemoryMappedCache(long capacityGB = 10)
        {
            _capacity = capacityGB * 1024L * 1024L * 1024L;
            var fileName = Path.GetTempFileName();
            
            using (var fs = new FileStream(fileName, FileMode.Create, FileAccess.Write))
            {
                fs.SetLength(_capacity);
            }

            _mmf = MemoryMappedFile.CreateFromFile(fileName, 
                FileMode.Open, 
                null, 
                _capacity, 
                MemoryMappedFileAccess.ReadWrite);
            
            _accessor = _mmf.CreateViewAccessor(0, _capacity, MemoryMappedFileAccess.ReadWrite);
            _accessor.SafeMemoryMappedViewHandle.AcquirePointer(ref _basePtr);
            _index = new ConcurrentDictionary<string, CacheEntry>();
            _currentOffset = 0;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool TryAdd(string key, ReadOnlySpan<byte> data)
        {
            var dataSize = data.Length;
            var alignedSize = AlignTo64(dataSize + sizeof(CacheHeader));
            
            var offset = Interlocked.Add(ref _currentOffset, alignedSize) - alignedSize;
            
            if (offset + alignedSize > _capacity)
                return false;

            // Write header
            var headerPtr = (CacheHeader*)(_basePtr + offset);
            headerPtr->Magic = 0xDEADBEEF;
            headerPtr->Size = dataSize;
            headerPtr->Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            
            // Write data using vectorized copy
            var dataPtr = _basePtr + offset + sizeof(CacheHeader);
            SimdMemCopy(data, new Span<byte>(dataPtr, dataSize));
            
            _index[key] = new CacheEntry { Offset = offset, Size = alignedSize };
            return true;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool TryGet(string key, Span<byte> buffer)
        {
            if (!_index.TryGetValue(key, out var entry))
                return false;

            var headerPtr = (CacheHeader*)(_basePtr + entry.Offset);
            if (headerPtr->Magic != 0xDEADBEEF)
                return false;

            var dataSize = headerPtr->Size;
            if (buffer.Length < dataSize)
                return false;

            var dataPtr = _basePtr + entry.Offset + sizeof(CacheHeader);
            SimdMemCopy(new ReadOnlySpan<byte>(dataPtr, dataSize), buffer.Slice(0, dataSize));
            
            return true;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private static void SimdMemCopy(ReadOnlySpan<byte> source, Span<byte> destination)
        {
            if (Avx2.IsSupported && source.Length >= 32)
            {
                SimdCopyAvx2(source, destination);
            }
            else
            {
                source.CopyTo(destination);
            }
        }

        private static unsafe void SimdCopyAvx2(ReadOnlySpan<byte> source, Span<byte> destination)
        {
            fixed (byte* pSrc = source)
            fixed (byte* pDst = destination)
            {
                var count = source.Length;
                var offset = 0;
                
                // Copy 32-byte chunks
                while (offset + 32 <= count)
                {
                    var vector = Avx2.LoadVector256(pSrc + offset);
                    Avx2.Store(pDst + offset, vector);
                    offset += 32;
                }
                
                // Copy remaining bytes
                for (int i = offset; i < count; i++)
                {
                    pDst[i] = pSrc[i];
                }
            }
        }

        private static long AlignTo64(long value) => (value + 63) & ~63L;

        public void Dispose()
        {
            _accessor?.SafeMemoryMappedViewHandle?.ReleasePointer();
            _accessor?.Dispose();
            _mmf?.Dispose();
        }

        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        private struct CacheHeader
        {
            public uint Magic;
            public int Size;
            public long Timestamp;
        }

        private struct CacheEntry
        {
            public long Offset;
            public long Size;
        }
    }
}
