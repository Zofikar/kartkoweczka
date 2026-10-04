enable_testing()

add_executable(openOmr_marker_positioner_tests
        test_marker_positioner.cpp
)

target_link_libraries(
        openOmr_marker_positioner_tests
        PRIVATE
        openOmr_core
)

add_test(
        NAME openOmr_marker_positioner_tests
        COMMAND openOmr_marker_positioner_tests
)

set_tests_properties(openOmr_marker_positioner_tests PROPERTIES LABELS "unit")

add_executable(openOmr_sheet_generator_tests
        test_sheet_generator.cpp
)

target_link_libraries(
        openOmr_sheet_generator_tests
        PRIVATE
        openOmr_core
)

add_test(
        NAME openOmr_sheet_generator_tests
        COMMAND openOmr_sheet_generator_tests
)

set_tests_properties(openOmr_sheet_generator_tests PROPERTIES LABELS "unit")

add_executable(openOmr_full_workflow_tests
        test_full_workflow.cpp
)

target_link_libraries(
        openOmr_full_workflow_tests
        PRIVATE
        openOmr_core
)

add_test(
        NAME openOmr_full_workflow_tests
        COMMAND openOmr_full_workflow_tests
)

set_tests_properties(openOmr_full_workflow_tests PROPERTIES LABELS "e2e")

add_executable(openOmr_qr_quality_tests
        test_qr_quality.cpp
)

target_link_libraries(
        openOmr_qr_quality_tests
        PRIVATE
        openOmr_core
)

add_test(
        NAME openOmr_qr_quality_tests
        COMMAND openOmr_qr_quality_tests
)

set_tests_properties(openOmr_qr_quality_tests PROPERTIES LABELS "unit")

add_executable(openOmr_randomized_workflow_tests
        test_randomized_workflow.cpp
)

target_link_libraries(
        openOmr_randomized_workflow_tests
        PRIVATE
        openOmr_core
)

add_test(
        NAME openOmr_randomized_workflow_tests
        COMMAND openOmr_randomized_workflow_tests
)

set_tests_properties(openOmr_randomized_workflow_tests PROPERTIES LABELS "e2e")