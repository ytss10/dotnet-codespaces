using System;
using System.Threading;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Intrinsics;
using System.Runtime.Intrinsics.X86;

namespace MultiSiteLoader.Core
{
    public class LockFreeRingBuffer<T> where T : class
    {
        private readonly T[] _buffer;
        private readonly int _mask;
        private long _head;
        private long _tail;
        private readonly int _paddingSize = 128; // Cache line padding

        public LockFreeRingBuffer(int capacity)
        {
            if ((capacity & (capacity - 1)) != 0)
                capacity = NextPowerOfTwo(capacity);
            
            _buffer = new T[capacity];
            _mask = capacity - 1;
            _head = 0;
            _tail = 0;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool TryEnqueue(T item)
        {
            var currentTail = Volatile.Read(ref _tail);
            var nextTail = currentTail + 1;
            
            if (nextTail - Volatile.Read(ref _head) > _buffer.Length)
                return false;

            var index = (int)(currentTail & _mask);
            
            if (Interlocked.CompareExchange(ref _tail, nextTail, currentTail) == currentTail)
            {
                _buffer[index] = item;
                return true;
            }

            return false;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool TryDequeue(out T item)
        {
            var currentHead = Volatile.Read(ref _head);
            
            if (currentHead >= Volatile.Read(ref _tail))
            {
                item = null;
                return false;
            }

            var index = (int)(currentHead & _mask);
            item = _buffer[index];
            
            if (item != null && Interlocked.CompareExchange(ref _head, currentHead + 1, currentHead) == currentHead)
            {
                _buffer[index] = null;
                return true;
            }

            item = null;
            return false;
        }

        private static int NextPowerOfTwo(int value)
        {
            value--;
            value |= value >> 1;
            value |= value >> 2;
            value |= value >> 4;
            value |= value >> 8;
            value |= value >> 16;
            return value + 1;
        }
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public unsafe struct SimdSiteProcessor
    {
        private fixed byte _buffer[64];
        
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static void ProcessBatch(ReadOnlySpan<byte> input, Span<byte> output)
        {
            if (Avx2.IsSupported)
            {
                ProcessAvx2(input, output);
            }
            else if (Sse2.IsSupported)
            {
                ProcessSse2(input, output);
            }
            else
            {
                ProcessScalar(input, output);
            }
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private static unsafe void ProcessAvx2(ReadOnlySpan<byte> input, Span<byte> output)
        {
            fixed (byte* pInput = input)
            fixed (byte* pOutput = output)
            {
                var vectorSize = Vector256<byte>.Count;
                var vectorCount = input.Length / vectorSize;
                
                for (int i = 0; i < vectorCount; i++)
                {
                    var vector = Avx2.LoadVector256(pInput + i * vectorSize);
                    var processed = Avx2.Add(vector, Vector256.Create((byte)1));
                    Avx2.Store(pOutput + i * vectorSize, processed);
                }
            }
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private static void ProcessSse2(ReadOnlySpan<byte> input, Span<byte> output)
        {
            // SSE2 implementation
            var vectorSize = Vector128<byte>.Count;
            for (int i = 0; i <= input.Length - vectorSize; i += vectorSize)
            {
                var vector = Vector128.Create(input.Slice(i, vectorSize));
                var processed = Sse2.Add(vector.AsInt32(), Vector128.Create(1).AsInt32());
                processed.AsByte().CopyTo(output.Slice(i, vectorSize));
            }
        }

        private static void ProcessScalar(ReadOnlySpan<byte> input, Span<byte> output)
        {
            for (int i = 0; i < input.Length; i++)
            {
                output[i] = (byte)(input[i] + 1);
            }
        }
    }
}
