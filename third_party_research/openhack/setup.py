from setuptools import find_packages, setup


setup(
    name="openhack",
    version="0.1.0",
    description=(
        "File-based, scenario-first workspace for source-guided whitebox "
        "security review."
    ),
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.9",
    install_requires=[
        "jsonschema>=4.18",
        "PyYAML>=6.0",
    ],
    extras_require={
        "dev": [
            "ruff>=0.6",
            "mypy>=1.10",
            "types-jsonschema",
        ],
    },
    entry_points={
        "console_scripts": [
            "openhack=openhack.cli:main",
        ],
    },
)
