from strix.llm.config import LLMConfig
from strix.llm.llm import LLM


def test_llm_config_whitebox_defaults_to_false(monkeypatch) -> None:
    monkeypatch.setenv("STRIX_LLM", "openai/gpt-5")
    config = LLMConfig()
    assert config.is_whitebox is False


def test_llm_config_whitebox_can_be_enabled(monkeypatch) -> None:
    monkeypatch.setenv("STRIX_LLM", "openai/gpt-5")
    config = LLMConfig(is_whitebox=True)
    assert config.is_whitebox is True


def test_whitebox_prompt_loads_source_aware_coordination_skill(monkeypatch) -> None:
    monkeypatch.setenv("STRIX_LLM", "openai/gpt-5")

    whitebox_llm = LLM(LLMConfig(scan_mode="quick", is_whitebox=True), agent_name="StrixAgent")
    assert "<source_aware_whitebox>" in whitebox_llm.system_prompt
    assert "<source_aware_sast>" in whitebox_llm.system_prompt
    assert "Begin with fast source triage" in whitebox_llm.system_prompt
    assert "You MUST begin at the very first step by running the code and testing live." not in (
        whitebox_llm.system_prompt
    )

    non_whitebox_llm = LLM(LLMConfig(scan_mode="quick", is_whitebox=False), agent_name="StrixAgent")
    assert "<source_aware_whitebox>" not in non_whitebox_llm.system_prompt
    assert "<source_aware_sast>" not in non_whitebox_llm.system_prompt
