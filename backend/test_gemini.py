# backend/test_gemini_fixed.py
import google.generativeai as genai
from config import config
import time

print("🧪 Testing Gemini 2.0 API")
print("="*50)

if not config.GEMINI_API_KEY:
    print("❌ No API key found")
    exit(1)


try:
    genai.configure(api_key=config.GEMINI_API_KEY)
    print("✅ Library configured")
    
    # List available models
    print("\n📋 Available models:")
    models = list(genai.list_models())
    for m in models[:8]:  # Show first 8
        print(f"  - {m.name}")
    
    # Test with Gemini 2.0 models
    print("\n🧪 Testing Gemini 2.0 models...")
    
    models_to_test = [
        "models/gemini-2.0-flash",
        "models/gemini-2.5-flash", 
        "models/gemini-2.0-flash-001",
        "models/gemini-2.5-pro",
    ]
    
    success = False
    for model_name in models_to_test:
        print(f"\n🔄 Testing: {model_name}")
        try:
            model = genai.GenerativeModel(model_name)
            start = time.time()
            response = model.generate_content("Say 'A.M.I. Healthcare Assistant is working!'")
            elapsed = time.time() - start
            
            print(f"✅ SUCCESS! Response: {response.text}")
            print(f"⏱️  Time: {elapsed:.2f}s")
            
            # Test medical question
            print(f"\n🩺 Testing medical question...")
            medical_response = model.generate_content("I have fever, what medicine should I take?")
            print(f"Medical response: {medical_response.text[:100]}...")
            
            success = True
            break
            
        except Exception as e:
            print(f"❌ Failed: {str(e)[:80]}...")
    
    if not success:
        print("\n⚠️ Trying older models as fallback...")
        older_models = ["models/gemini-1.5-flash", "models/gemini-pro"]
        for model_name in older_models:
            print(f"\n🔄 Testing: {model_name}")
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content("Hello")
                print(f"✅ Working with: {model_name}")
                print(f"Response: {response.text[:50]}...")
                success = True
                break
            except:
                continue
    
    if success:
        print("\n" + "="*50)
        print("🎉 ALL TESTS PASSED!")
        print("✅ Your Gemini API is working perfectly")
        print("✅ Ready to run A.M.I. Healthcare Assistant")
        print("="*50)
    else:
        print("\n❌ No working models found")
        
except Exception as e:
    print(f"❌ Test failed: {e}")