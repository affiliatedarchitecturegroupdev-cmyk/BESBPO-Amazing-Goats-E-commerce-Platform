import unittest
from unittest import mock

from fastapi.testclient import TestClient

from app import main
from app.suggestions import (
    APPROVED,
    DRAFT,
    InMemorySuggestionStore,
    SuggestionError,
    approve,
    new_suggestion,
)


class SuggestionRuleTests(unittest.TestCase):
    def test_a_new_suggestion_is_a_draft(self):
        s = new_suggestion(90, 100.0, 20.0, 0.1, 10, at="2026-11-14T10:00:00Z")
        self.assertEqual(s.status, DRAFT)
        self.assertEqual(s.units, 90)
        self.assertIsNone(s.approved_by)
        self.assertEqual(s.created_at, "2026-11-14T10:00:00Z")

    def test_approve_promotes_a_draft_and_names_the_person(self):
        s = new_suggestion(90, 100.0, 20.0, 0.1, 10)
        approved = approve(s, "buyer-1", at="2026-11-14T11:00:00Z")
        self.assertEqual(approved.status, APPROVED)
        self.assertEqual(approved.approved_by, "buyer-1")
        self.assertEqual(approved.approved_at, "2026-11-14T11:00:00Z")

    def test_approve_refuses_an_already_approved_suggestion(self):
        s = approve(new_suggestion(90, 100.0, 20.0, 0.1, 10), "buyer-1")
        with self.assertRaises(SuggestionError):
            approve(s, "buyer-2")

    def test_approve_needs_a_named_person(self):
        with self.assertRaises(SuggestionError):
            approve(new_suggestion(90, 100.0, 20.0, 0.1, 10), "")


class SuggestionStoreTests(unittest.TestCase):
    def test_lists_newest_first_and_filters_by_status(self):
        store = InMemorySuggestionStore()
        first = store.add(new_suggestion(1, 1.0, 0.0, 0.1, 1, at="2026-11-14T09:00:00Z"))
        second = store.add(new_suggestion(2, 2.0, 0.0, 0.1, 1, at="2026-11-14T10:00:00Z"))
        store.replace(approve(second, "buyer-1"))

        self.assertEqual([s.id for s in store.list()], [second.id, first.id])
        self.assertEqual([s.id for s in store.list(DRAFT)], [first.id])
        self.assertEqual([s.id for s in store.list(APPROVED)], [second.id])

    def test_replace_refuses_an_unknown_id(self):
        with self.assertRaises(SuggestionError):
            InMemorySuggestionStore().replace(new_suggestion(1, 1.0, 0.0, 0.1, 1))


class SuggestionEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.store = InMemorySuggestionStore()
        self._patch = mock.patch.object(main, "_store", self.store)
        self._patch.start()

    def tearDown(self):
        self._patch.stop()

    def test_suggest_buy_persists_a_draft(self):
        response = self.client.post("/suggest-buy", json={"forecast_units": 100, "on_hand": 20, "safety": 0.1, "pack": 10})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["units"], 90)
        self.assertEqual(body["status"], DRAFT)

        # The draft is persisted, not just returned.
        listed = self.client.get("/suggestions?status=draft").json()
        self.assertEqual([s["id"] for s in listed], [body["id"]])

    def test_approve_promotes_the_suggestion(self):
        created = self.client.post("/suggest-buy", json={"forecast_units": 100, "on_hand": 20, "pack": 10}).json()
        response = self.client.post(f"/suggestions/{created['id']}/approve", json={"approved_by": "buyer-1"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], APPROVED)
        self.assertEqual(response.json()["approved_by"], "buyer-1")
        # It is no longer a draft.
        self.assertEqual(self.client.get("/suggestions?status=draft").json(), [])

    def test_approving_twice_is_a_conflict(self):
        created = self.client.post("/suggest-buy", json={"forecast_units": 100, "on_hand": 20, "pack": 10}).json()
        self.client.post(f"/suggestions/{created['id']}/approve", json={"approved_by": "buyer-1"})
        again = self.client.post(f"/suggestions/{created['id']}/approve", json={"approved_by": "buyer-2"})
        self.assertEqual(again.status_code, 409)

    def test_approving_an_unknown_id_is_not_found(self):
        response = self.client.post("/suggestions/nope/approve", json={"approved_by": "buyer-1"})
        self.assertEqual(response.status_code, 404)

    def test_listing_with_no_suggestions_is_empty(self):
        self.assertEqual(self.client.get("/suggestions").json(), [])


if __name__ == "__main__":
    unittest.main()
