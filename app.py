"""
AWS Rekognition CompareFaces – Flask Backend
"""

import os
import boto3
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

# Prevent old session tokens from overriding the IAM credentials
os.environ.pop("AWS_SESSION_TOKEN", None)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB upload limit

REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")


def _get_client():
    return boto3.client(
        "rekognition",
        region_name=REGION,
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY")
    )


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/compare", methods=["POST"])
def compare_faces():
    source = request.files.get("source")
    target = request.files.get("target")

    if not source or not target:
        return jsonify({"error": "Both source and target images are required."}), 400

    similarity_threshold = float(request.form.get("threshold", 80))

    try:
        client = _get_client()
        response = client.compare_faces(
            SourceImage={"Bytes": source.read()},
            TargetImage={"Bytes": target.read()},
            SimilarityThreshold=similarity_threshold,
        )

        # Strip non-serialisable metadata
        response.pop("ResponseMetadata", None)

        return jsonify(response)

    except client.exceptions.InvalidParameterException as exc:
        return jsonify({"error": f"Invalid image: {exc}"}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5002)
