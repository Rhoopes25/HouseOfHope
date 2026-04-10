using Microsoft.ML.OnnxRuntime;

namespace HouseOfHope.API.Services;

/// <summary>
/// skl2onnx classifiers emit <c>output_label</c> (int64) and <c>output_probability</c> as
/// <c>seq(map(int64, tensor(float)))</c>. Do not read <c>results.First()</c> as a float tensor.
/// </summary>
internal static class SklearnOnnxOutputs
{
    /// <summary>P(class = <paramref name="positiveClassKey"/>), e.g. key 1 for binary positive.</summary>
    internal static float ExtractBinaryPositiveClassProbability(
        IEnumerable<DisposableNamedOnnxValue> outputs,
        long positiveClassKey = 1)
    {
        try
        {
            var probOutput = outputs.FirstOrDefault(o =>
                string.Equals(o.Name, "output_probability", StringComparison.Ordinal));
            probOutput ??= outputs.ElementAtOrDefault(1);

            if (probOutput == null)
                return float.NaN;

            var seq = probOutput.AsEnumerable<NamedOnnxValue>();
            if (seq == null)
                return float.NaN;

            var mapNode = seq.FirstOrDefault();
            if (mapNode == null)
                return float.NaN;

            var map = mapNode.AsDictionary<long, float>();
            return map.TryGetValue(positiveClassKey, out var p) ? p : float.NaN;
        }
        catch
        {
            return float.NaN;
        }
    }
}
