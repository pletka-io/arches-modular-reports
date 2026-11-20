import inspect
import uuid
from unittest import mock

from django.test import RequestFactory, SimpleTestCase
from django.urls import reverse

from arches.app.views.api.resource import ResourceReport

from arches_modular_reports.app.views import modular_report
from arches_modular_reports.app.views.classic_report import (
    CLASSIC_TEMPLATE_ID,
    ClassicResourceReport,
)

CORE_LINE = "models.ReportTemplate.objects.get(pk=graph.template_id)"
OUR_LINE = "models.ReportTemplate.objects.get(pk=CLASSIC_TEMPLATE_ID)"


class ClassicResourceReportTests(SimpleTestCase):
    def test_get_is_core_with_only_the_template_changed(self):
        # Fails after an Arches upgrade that changes ResourceReport.get:
        # copy the new core source and change the template line again.
        core = inspect.getsource(ResourceReport.get)
        self.assertIn(CORE_LINE, core)
        self.assertEqual(
            inspect.getsource(ClassicResourceReport.get),
            core.replace(CORE_LINE, OUR_LINE),
        )

    def test_copy_has_every_global_core_get_uses(self):
        import arches.app.views.api.resource as core_module

        from arches_modular_reports.app.views import classic_report

        used = {
            name
            for name in ResourceReport.get.__code__.co_names
            if name in vars(core_module)
        }
        self.assertEqual(used - set(vars(classic_report)), set())

    def test_classic_template_is_no_header_template(self):
        self.assertEqual(CLASSIC_TEMPLATE_ID, "50000000-0000-0000-0000-000000000001")

    def test_route(self):
        rid = uuid.uuid4()
        self.assertEqual(
            reverse("api_resource_report_classic", args=[rid]),
            f"/api/resource_report_classic/{rid}",
        )


class ClassicViewParamTests(SimpleTestCase):
    def render_view(self, query):
        graph = mock.Mock(iconclass=None)
        graph.name = "Period"
        graph.template.componentname = "modular-report"
        view = modular_report.ModularReportAwareResourceReportView()
        request = RequestFactory().get("/report/x" + query)
        with (
            mock.patch.object(modular_report.models, "GraphModel") as gm,
            mock.patch.object(modular_report.models, "ResourceInstance"),
            mock.patch.object(modular_report, "get_report_config"),
            # the modular branch skips MapBaseManagerView's get_context_data
            mock.patch.object(
                modular_report.MapBaseManagerView.__mro__[1],
                "get_context_data",
                side_effect=lambda **kw: {"nav": {}, **kw},
            ),
            mock.patch.object(
                view, "get_context_data", side_effect=lambda **kw: {"nav": {}, **kw}
            ),
            mock.patch.object(modular_report, "render") as render,
        ):
            gm.objects.filter.return_value.select_related.return_value.first.return_value = (
                graph
            )
            view.get(request, resourceid=uuid.uuid4())
        _, template, context = render.call_args.args
        return template, context

    def test_modular_graph_renders_modular_by_default(self):
        template, context = self.render_view("")
        self.assertEqual(template, "views/resource/modular_report.htm")
        self.assertFalse(context.get("classic_report"))

    def test_view_classic_renders_the_classic_report(self):
        template, context = self.render_view("?view=classic")
        self.assertEqual(template, "views/resource/report.htm")
        self.assertTrue(context["classic_report"])
