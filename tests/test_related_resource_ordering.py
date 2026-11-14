from unittest import mock

from django.db.models import F
from django.db.models.functions import Length
from django.test import RequestFactory, SimpleTestCase

from arches_modular_reports.app.utils.nodegroup_tile_data_utils import (
    relation_ordering,
)
from arches_modular_reports.app.views import modular_report
from arches_modular_reports.app.views.modular_report import RelatedResourceView


def sort_keys(ordering):
    """(expression class, descending) for each ordering key."""
    return [(type(key.expression), key.descending) for key in ordering]


class RelationOrderingTests(SimpleTestCase):
    def test_default_orders_by_the_field_alone(self):
        ordering = relation_ordering("identifier", "asc")
        self.assertEqual(sort_keys(ordering), [(F, False)])
        self.assertTrue(ordering[0].nulls_last)

    def test_natural_orders_by_length_then_value(self):
        # Length first, so "2" sorts before "10"; plain string order puts "10" first.
        ordering = relation_ordering("identifier", "asc", natural=True)
        self.assertEqual(sort_keys(ordering), [(Length, False), (F, False)])
        self.assertTrue(all(key.nulls_last for key in ordering))

    def test_direction_applies_to_every_key(self):
        self.assertEqual(
            sort_keys(relation_ordering("identifier", "desc")), [(F, True)]
        )
        self.assertEqual(
            sort_keys(relation_ordering("identifier", "DESC", natural=True)),
            [(Length, True), (F, True)],
        )
        self.assertEqual(
            sort_keys(relation_ordering("identifier", "ascending", natural=True)),
            [(Length, False), (F, False)],
        )


class RelatedResourceViewNaturalParamTests(SimpleTestCase):
    def get_natural_arg(self, query_string):
        request = RequestFactory().get("/related/" + query_string)
        request.user = mock.Mock()
        with (
            mock.patch.object(modular_report.models, "ResourceInstance"),
            mock.patch.object(modular_report.models, "GraphModel") as graph_model,
            mock.patch.object(modular_report, "get_nodegroups_by_perm"),
            mock.patch.object(modular_report, "group_required"),
            mock.patch.object(
                modular_report, "annotate_related_graph_nodes_with_widget_labels"
            ) as annotate_nodes,
            mock.patch.object(
                modular_report, "get_sorted_filtered_relations"
            ) as get_relations,
        ):
            graph_model.objects.get.return_value.name = "Some graph"
            annotate_nodes.return_value = []
            get_relations.return_value = []
            response = RelatedResourceView().get(request, "res-id", "some_graph")
        self.assertEqual(response.status_code, 200)
        return get_relations.call_args.kwargs["natural"]

    def test_natural_true_is_passed_on(self):
        self.assertIs(self.get_natural_arg("?natural=true"), True)
        self.assertIs(self.get_natural_arg("?natural=True"), True)

    def test_natural_defaults_to_false(self):
        self.assertIs(self.get_natural_arg(""), False)
        self.assertIs(self.get_natural_arg("?natural=false"), False)
        self.assertIs(self.get_natural_arg("?natural=1"), False)
