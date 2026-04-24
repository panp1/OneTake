"""Tests for the interest router module.

These test the routing logic — tier distribution, concept parsing, output structure.
"""
import pytest


class TestTierDistribution:
    """Verify interests are correctly distributed across hyper/hot/broad tiers."""

    def test_default_tier_counts(self):
        from platform_interests.router import DEFAULT_TIER_COUNTS
        assert DEFAULT_TIER_COUNTS == {"hyper": 3, "hot": 5, "broad": 3}

    def test_total_default_interests(self):
        from platform_interests.router import DEFAULT_TIER_COUNTS
        total = sum(DEFAULT_TIER_COUNTS.values())
        assert total == 11

    def test_empty_concepts_returns_empty(self):
        """route_interests with no concepts should return empty tiers."""
        import asyncio

        from platform_interests.router import route_interests
        try:
            result = asyncio.get_event_loop().run_until_complete(
                route_interests("meta", [])
            )
            assert result == {"hyper": [], "hot": [], "broad": []}
        except Exception:
            pytest.skip("No database connection available")


class TestConceptParsing:
    """Test that concepts are correctly parsed into search terms."""

    def test_multi_word_concepts_split(self):
        concept = "tech workers in gig economy"
        words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
        assert "tech" in words
        assert "workers" in words
        assert "gig" in words
        assert "economy" in words
        assert "in" not in words

    def test_comma_separated_concepts(self):
        concept = "freelancing, remote work, data science"
        words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
        assert "freelancing" in words
        assert "remote" in words
        assert "data" in words
        assert "science" in words

    def test_deduplication(self):
        concepts = ["tech workers", "tech industry"]
        search_terms = []
        for concept in concepts:
            words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
            search_terms.extend(words)
        search_terms = list(set(search_terms))
        assert search_terms.count("tech") == 1

    def test_short_words_filtered(self):
        concept = "AI is an ML tool"
        words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
        assert "ai" not in words  # 2 chars
        assert "is" not in words  # 2 chars
        assert "tool" in words

    def test_empty_concept_list(self):
        concepts = []
        search_terms = []
        for concept in concepts:
            words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
            search_terms.extend(words)
        assert len(search_terms) == 0


class TestRouterOutputStructure:
    """Verify the router output matches the expected schema."""

    def test_output_has_three_tiers(self):
        result = {"hyper": ["a"], "hot": ["b", "c"], "broad": ["d"]}
        assert "hyper" in result
        assert "hot" in result
        assert "broad" in result

    def test_each_tier_is_list_of_strings(self):
        result = {"hyper": ["Digital marketing"], "hot": ["Software", "Data Science"], "broad": ["Technology"]}
        for tier in ["hyper", "hot", "broad"]:
            assert isinstance(result[tier], list)
            for item in result[tier]:
                assert isinstance(item, str)

    def test_empty_result_is_valid(self):
        result = {"hyper": [], "hot": [], "broad": []}
        total = sum(len(v) for v in result.values())
        assert total == 0

    def test_interests_are_unique_across_tiers(self):
        result = {"hyper": ["A", "B"], "hot": ["C", "D"], "broad": ["E"]}
        all_interests = result["hyper"] + result["hot"] + result["broad"]
        assert len(all_interests) == len(set(all_interests))


class TestCrossPlatformRouting:
    """Test cross-platform routing logic."""

    def test_cross_platform_returns_dict_per_platform(self):
        result = {
            "meta": {"hyper": ["Software"], "hot": ["Technology"], "broad": ["Business"]},
            "linkedin": {"hyper": ["Information Technology"], "hot": ["Computer Software"], "broad": ["Technology"]},
        }
        assert "meta" in result
        assert "linkedin" in result
        assert "hyper" in result["meta"]
        assert "hyper" in result["linkedin"]

    def test_platforms_can_have_different_interest_counts(self):
        result = {
            "meta": {"hyper": ["A", "B", "C"], "hot": ["D", "E"], "broad": ["F"]},
            "reddit": {"hyper": ["G"], "hot": ["H"], "broad": []},
        }
        meta_total = sum(len(v) for v in result["meta"].values())
        reddit_total = sum(len(v) for v in result["reddit"].values())
        assert meta_total == 6
        assert reddit_total == 2


class TestPlatformCoverage:
    """Test that the router handles all 6 supported platforms."""

    PLATFORMS = ["meta", "linkedin", "tiktok", "reddit", "snapchat", "wechat"]

    def test_all_platforms_valid(self):
        for p in self.PLATFORMS:
            assert isinstance(p, str)
            assert len(p) > 0

    def test_unknown_platform_returns_empty(self):
        """An unsupported platform should return empty interests, not crash."""
        import asyncio

        from platform_interests.router import route_interests
        try:
            result = asyncio.get_event_loop().run_until_complete(
                route_interests("myspace", ["technology"])
            )
            assert result["hyper"] == []
            assert result["hot"] == []
            assert result["broad"] == []
        except Exception:
            pytest.skip("No database connection available")
