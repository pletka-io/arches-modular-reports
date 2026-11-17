from unittest import mock

from django.core.exceptions import ValidationError
from django.db.models import Case, TextField, Value
from django.db.models.fields.json import KeyTextTransform
from django.test import RequestFactory, SimpleTestCase

from arches_modular_reports import models as report_models
from arches_modular_reports.app.utils.nodegroup_tile_data_utils import (
    relation_name_expression,
)
from arches_modular_reports.app.views import modular_report
from arches_modular_reports.app.views.modular_report import RelatedResourceView


class RelationNameExpressionTests(SimpleTestCase):
    def test_without_reverse_labels_uses_the_widget_label(self):
        expr = relation_name_expression("res", "to_resource", "node", {}, "en")
        self.assertIsInstance(expr, KeyTextTransform)

    def test_reverse_label_applies_to_incoming_relations_of_that_node(self):
        expr = relation_name_expression(
            "res", "to_resource", "node", {"part_of_context": "Contains artefact"}, "en"
        )
        self.assertIsInstance(expr, Case)
        (when,) = expr.cases
        self.assertEqual(
            dict(when.condition.children),
            {"to_resource": "res", "node__alias": "part_of_context"},
        )
        self.assertEqual(when.result, Value("Contains artefact"))
        self.assertIsInstance(expr.default, KeyTextTransform)
        # Value(str) is a CharField, the widget label a TextField: Case must
        # name its type or Django refuses the mix.
        self.assertIsInstance(expr.output_field, TextField)


class RelatedResourceViewReverseLabelsParamTests(SimpleTestCase):
    def get_reverse_labels_arg(self, query_string):
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
        return get_relations.call_args.kwargs["reverse_labels"]

    def test_reverse_labels_are_passed_on(self):
        self.assertEqual(
            self.get_reverse_labels_arg(
                '?reverse_labels={"part_of_context":"Contains artefact"}'
            ),
            {"part_of_context": "Contains artefact"},
        )

    def test_reverse_labels_default_to_empty(self):
        self.assertEqual(self.get_reverse_labels_arg(""), {})

    def test_malformed_reverse_labels_are_ignored(self):
        self.assertEqual(self.get_reverse_labels_arg("?reverse_labels=nope"), {})
        self.assertEqual(self.get_reverse_labels_arg("?reverse_labels=[1]"), {})
        self.assertEqual(
            self.get_reverse_labels_arg('?reverse_labels={"a":1,"b":"B"}'),
            {"b": "B"},
        )


class ReverseLabelsValidationTests(SimpleTestCase):
    def validate(self, rr_config):
        node = mock.Mock(alias="part_of_context")
        with mock.patch.object(report_models, "GraphModel") as graph_model:
            graph_model.objects.get.return_value.node_set.exclude.return_value = [node]
            report_models.ReportConfig().validate_relatedresourcessection(rr_config)

    def test_reverse_labels_on_related_graph_nodes_are_valid(self):
        self.validate(
            {
                "graph_slug": "artefact",
                "node_aliases": [],
                "reverse_labels": {"part_of_context": "Contains artefact"},
            }
        )

    def test_reverse_labels_on_unknown_nodes_are_rejected(self):
        with self.assertRaisesRegex(ValidationError, "part_of_kontext"):
            self.validate(
                {
                    "graph_slug": "artefact",
                    "node_aliases": [],
                    "reverse_labels": {"part_of_kontext": "Contains artefact"},
                }
            )
