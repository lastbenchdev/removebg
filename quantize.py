import sys
import os

try:
    from onnxruntime.quantization import quantize_dynamic, QuantType
except ImportError:
    print("onnxruntime is not installed.")
    print("Please run: pip install onnx onnxruntime")
    sys.exit(1)

model_input = "public/assets/models/model.onnx"
model_output = "public/assets/models/model_quantized.onnx"

if not os.path.exists(model_input):
    print(f"Cannot find {model_input}")
    sys.exit(1)

print(f"Quantizing {model_input}...")
quantize_dynamic(model_input, model_output, weight_type=QuantType.QUInt8)
print(f"Quantization complete! Saved to {model_output}")

size_orig = os.path.getsize(model_input) / (1024*1024)
size_new = os.path.getsize(model_output) / (1024*1024)
print(f"Original size: {size_orig:.2f} MB")
print(f"Quantized size: {size_new:.2f} MB")
